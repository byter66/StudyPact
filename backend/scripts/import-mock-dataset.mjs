import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const DATASET = "Hellboi78688/jee-neet-benchmark";
const DATASET_API = `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(DATASET)}&config=default&split=test`;
const IMAGE_BUCKET = "mock-question-images";
const PAGE_SIZE = 100;
const IMAGE_CONCURRENCY = 8;
const dryRun = process.argv.includes("--dry-run");
const failedAssets = [];

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!dryRun && (!supabaseUrl || !serviceRoleKey)) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in backend/.env.");
}

const supabase = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  : null;

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const fetchJson = async (url, label) => {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`${label} returned HTTP ${response.status}.`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 4) await delay(500 * (attempt + 1));
    }
  }
  throw lastError;
};

const mapQuestionType = (value) => {
  const type = String(value ?? "").toUpperCase();
  if (type === "MCQ_SINGLE_CORRECT" || type === "MCQ_SINGLE") return "MCQ_SINGLE";
  if (type === "MCQ_MULTI_CORRECT" || type === "MCQ_MULTIPLE_CORRECT" || type === "MCQ_MULTI") return "MCQ_MULTI";
  if (type === "MATCHING_LIST" || type === "MCQ_MATCHING") return "MATCHING_LIST";
  if (type.startsWith("INTEGER") || type === "NUMERICAL") return "NUMERICAL";
  return null;
};

const getPaperGroup = (row) => {
  const examName = String(row.exam_name ?? "").trim();
  const examYear = Number(row.exam_year);
  const questionId = String(row.question_id ?? "").trim();
  if (!examName || !Number.isInteger(examYear) || !questionId) {
    throw new Error(`Dataset row ${row.question_id ?? "(missing id)"} lacks exam name, year, or question id.`);
  }

  let paperCode;
  if (examName === "JEE_ADVANCED" && row.paper_id !== null && row.paper_id !== undefined) {
    paperCode = `P${String(row.paper_id)}`;
  } else if (examName === "NEET") {
    const yearPrefix = `N${String(examYear).slice(-2)}`;
    const code = questionId.startsWith(yearPrefix) ? questionId.slice(yearPrefix.length, -3) : "";
    if (!code || !/^[A-Z0-9]+$/.test(code)) {
      throw new Error(`Cannot safely determine the NEET source-paper code from ${questionId}.`);
    }
    paperCode = code;
  } else {
    throw new Error(`Cannot safely group ${examName} ${examYear} question ${questionId} into a source paper.`);
  }

  return {
    examName,
    examYear,
    paperCode,
    sourceReference: `huggingface:${DATASET}:test:${examName}:${examYear}:${paperCode}`,
  };
};

const withConcurrency = async (items, limit, task) => {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await task(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
};

const ensureImageBucket = async () => {
  const { data: bucket, error: bucketError } = await supabase.storage.getBucket(IMAGE_BUCKET);
  if (bucketError && bucketError.statusCode !== "404") {
    throw bucketError;
  }
  if (!bucket) {
    const { error } = await supabase.storage.createBucket(IMAGE_BUCKET, { public: true });
    if (error) throw error;
  } else if (!bucket.public) {
    const { error } = await supabase.storage.updateBucket(IMAGE_BUCKET, { public: true });
    if (error) throw error;
  }
};

const assertDatabaseReady = async () => {
  const { error } = await supabase
    .from("mock_sessions")
    .select("created_by")
    .limit(0);
  if (error) {
    throw new Error(`Apply the mock dataset/session migration before importing: ${error.message}`);
  }
};

const identifyImage = (bytes, imageUrl) => {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extension: "jpg", contentType: "image/jpeg" };
  }
  if (
    bytes.length >= 8
    && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { extension: "png", contentType: "image/png" };
  }
  if (
    bytes.length >= 6
    && (bytes.subarray(0, 6).toString("ascii") === "GIF87a" || bytes.subarray(0, 6).toString("ascii") === "GIF89a")
  ) {
    return { extension: "gif", contentType: "image/gif" };
  }
  if (
    bytes.length >= 12
    && bytes.subarray(0, 4).toString("ascii") === "RIFF"
    && bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { extension: "webp", contentType: "image/webp" };
  }

  const extension = new URL(imageUrl).pathname.match(/\.(jpe?g|png|gif|webp)$/i)?.[1]?.toLowerCase();
  if (extension) {
    const normalizedExtension = extension === "jpeg" ? "jpg" : extension;
    return {
      extension: normalizedExtension,
      contentType: normalizedExtension === "jpg" ? "image/jpeg" : `image/${normalizedExtension}`,
    };
  }
  return null;
};

const storeImage = async (row, group) => {
  const imageUrl = row.image?.src;
  const questionId = String(row.question_id ?? "");
  if (!imageUrl || !questionId) {
    throw new Error(`Dataset question ${questionId || "(missing id)"} has no source image URL.`);
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Unable to download source image for ${questionId}: HTTP ${response.status}.`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const image = identifyImage(bytes, response.url || imageUrl);
  if (!image) {
    const contentType = response.headers.get("content-type") || "not provided";
    throw new Error(`Source asset is not a supported image (Content-Type: ${contentType}; no supported image signature or filename extension).`);
  }

  const objectPath = `${group.examName}/${group.examYear}/${group.paperCode}/${questionId}.${image.extension}`;
  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(objectPath, bytes, {
      contentType: image.contentType,
      upsert: true,
    });

  if (error) throw new Error(`Unable to store source image for ${questionId}: ${error.message}`);
  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
};

const fetchDatasetRows = async (dryRun) => {
  const firstPage = await fetchJson(`${DATASET_API}&offset=0&length=1`, "Dataset metadata request");
  const totalRows = Number(firstPage.num_rows_total);
  if (!Number.isInteger(totalRows) || totalRows < 1) {
    throw new Error("The dataset did not report any rows.");
  }

  const allRows = [];
  for (let offset = 0; offset < totalRows; offset += PAGE_SIZE) {
    const length = Math.min(PAGE_SIZE, totalRows - offset);
    const page = await fetchJson(`${DATASET_API}&offset=${offset}&length=${length}`, `Dataset page at offset ${offset}`);
    const rows = (page.rows ?? []).map(({ row }) => row);
    if (rows.length !== length) {
      throw new Error(`Dataset page at offset ${offset} returned ${rows.length} rows; expected ${length}.`);
    }

    const mappedRows = rows.map((row) => {
      const group = getPaperGroup(row);
      const questionType = mapQuestionType(row.question_type);
      if (!questionType) {
        throw new Error(`Cannot map question type "${row.question_type}" for ${row.question_id} to mock_questions.question_type.`);
      }
      return { ...row, group, mappedQuestionType: questionType };
    });
    if (dryRun) {
      allRows.push(...mappedRows);
    } else {
      const withImages = await withConcurrency(mappedRows, IMAGE_CONCURRENCY, async (row) => ({
        row,
        result: await storeImage(row, row.group).then(
          (storedImageUrl) => ({ storedImageUrl }),
          (error) => ({ assetError: error?.message || String(error) }),
        ),
      }));
      for (const { row, result } of withImages) {
        if (result.assetError) {
          const failure = { questionId: row.question_id, error: result.assetError };
          failedAssets.push(failure);
          console.error(`Skipping source question ${failure.questionId}: ${failure.error}`);
          continue;
        }
        allRows.push({ ...row, storedImageUrl: result.storedImageUrl });
      }
    }
    console.log(`${dryRun ? "Checked" : "Imported images for"} ${Math.min(offset + length, totalRows)} / ${totalRows} dataset records.`);
  }

  return allRows;
};

const persistPapers = async (rows) => {
  const groups = new Map();
  for (const row of rows.filter((item) => item.storedImageUrl)) {
    const key = row.group.sourceReference;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  let importedQuestions = 0;
  for (const [sourceReference, questions] of groups) {
    const { examName, examYear, paperCode } = questions[0].group;
    const subjects = [...new Set(questions.map((row) => String(row.subject ?? "").trim()).filter(Boolean))].sort();
    if (subjects.length === 0) {
      throw new Error(`No subject metadata was provided for ${sourceReference}.`);
    }

    const paperName = examName === "JEE_ADVANCED" ? `Paper ${paperCode.slice(1)}` : `Code ${paperCode}`;
    const { data: existingPaper, error: findError } = await supabase
      .from("mock_papers")
      .select("id")
      .eq("source_reference", sourceReference)
      .maybeSingle();
    if (findError) throw findError;

    const paperValues = {
      exam_name: examName,
      exam_year: examYear,
      paper_name: paperName,
      subject: subjects.length === 1 ? subjects[0] : "All subjects",
      duration_seconds: 0,
      total_marks: 0,
      evaluation_type: "objective",
      source: `huggingface:${DATASET}`,
      source_reference: sourceReference,
    };

    let paperId = existingPaper?.id;
    if (paperId) {
      const { error } = await supabase.from("mock_papers").update(paperValues).eq("id", paperId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from("mock_papers").insert(paperValues).select("id").single();
      if (error) throw error;
      paperId = data.id;
    }

    const orderedQuestions = [...questions].sort((left, right) =>
      String(left.question_id).localeCompare(String(right.question_id), undefined, { numeric: true }),
    );
    const questionRows = orderedQuestions.map((row, index) => ({
      paper_id: paperId,
      question_number: index + 1,
      question_type: row.mappedQuestionType,
      question_text: String(row.question_id),
      options: null,
      correct_answer: typeof row.correct_answer === "string" ? row.correct_answer : null,
      max_marks: 0,
      negative_marks: 0,
      marking_scheme: null,
      metadata: {
        subject: row.subject,
        source_dataset: DATASET,
        source_question_id: row.question_id,
        source_paper_id: row.paper_id ?? null,
        source_question_type: row.question_type,
        image_url: row.storedImageUrl,
      },
    }));

    const { error: upsertError } = await supabase
      .from("mock_questions")
      .upsert(questionRows, { onConflict: "paper_id,question_number" });
    if (upsertError) throw upsertError;

    const { error: staleRowsError } = await supabase
      .from("mock_questions")
      .delete()
      .eq("paper_id", paperId)
      .gt("question_number", questionRows.length);
    if (staleRowsError) throw staleRowsError;

    importedQuestions += questionRows.length;
    console.log(`${examName} ${examYear} ${paperName}: ${questionRows.length} source questions.`);
  }

  return { paperCount: groups.size, questionCount: importedQuestions };
};

if (!dryRun) {
  await assertDatabaseReady();
  await ensureImageBucket();
}
const rows = await fetchDatasetRows(dryRun);
const groups = new Set(rows.map((row) => row.group.sourceReference));

if (dryRun) {
  console.log(`Dry run passed: ${rows.length} source questions map to ${groups.size} database-backed paper collections.`);
  console.log("Duration and total marks are absent from the source and will remain unavailable (stored as 0).");
} else {
  const result = await persistPapers(rows);
  console.log(`Import complete: ${result.paperCount} papers and ${result.questionCount} questions.`);
  console.log(`Successfully stored question images: ${result.questionCount}.`);
  console.log(`Skipped/failed assets: ${failedAssets.length}.`);
  if (failedAssets.length > 0) {
    console.log(`Skipped source question IDs: ${failedAssets.map(({ questionId }) => questionId).join(", ")}`);
  }
  console.log("Each paper uses a generated database UUID; Hugging Face source references are stored separately.");
}
