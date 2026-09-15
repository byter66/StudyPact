import { supabase, supabaseAdmin } from "../config/supabase";
import { normalizeIndianPhone, sendOtp as sendDevelopmentOtp, verifyOtp as verifyDevelopmentOtp } from "./otp.service";

type ProfilePayload = {
  id: string;
  full_name: string | null;
  email?: string | null;
  phone_number: string;
  phone_verified: boolean;
  updated_at: string;
};

const devTokenPayload = (user: { id: string; phone: string; full_name: string | null }) => {
  const payload = {
    id: user.id,
    phone: user.phone,
    full_name: user.full_name,
  };

  return `dev-token-${Buffer.from(JSON.stringify(payload), "utf8").toString("base64")}`;
};

const decodeDevToken = (token: string) => {
  if (!token.startsWith("dev-token-")) {
    return null;
  }

  try {
    const payload = Buffer.from(token.replace("dev-token-", ""), "base64").toString("utf8");
    return JSON.parse(payload);
  } catch {
    return null;
  }
};

const sanitizeProfileName = (fullName?: string | null): string => {
  const value = fullName?.trim();
  return value && value.length > 0 ? value : "StudyPact user";
};

const saveProfile = async (userId: string, fullName: string | null, phone: string, email?: string | null) => {
  if (!supabaseAdmin) {
    return;
  }

  const payload: ProfilePayload = {
    id: userId,
    full_name: sanitizeProfileName(fullName),
    email: email ?? null,
    phone_number: phone,
    phone_verified: true,
    updated_at: new Date().toISOString(),
  };

  try {
    const { error } = await supabaseAdmin.from("profiles").upsert(payload, { onConflict: "id" });

    if (error) {
      console.warn("Unable to persist profile:", error.message);
    }
  } catch (error) {
    console.warn("Unable to persist profile:", error);
  }
};

const mapSupabaseUser = (user: any, fallbackFullName?: string | null) => {
  const metadata = user?.user_metadata ?? {};
  const fullName = metadata.full_name ?? metadata.name ?? fallbackFullName ?? "StudyPact user";

  return {
    id: user.id,
    email: user.email ?? null,
    phone: user.phone ?? metadata.phone ?? null,
    full_name: fullName,
    phone_verified: Boolean(user.phone_confirmed_at || metadata.phone_verified || user.phone),
  };
};

export const requestOtp = async (phone: string, fullName?: string) => {
  const normalizedPhone = normalizeIndianPhone(phone);

  if (!normalizedPhone) {
    return {
      data: null,
      error: new Error("Enter a valid Indian mobile number."),
    };
  }

  if (process.env.NODE_ENV !== "production") {
    const result = await sendDevelopmentOtp(normalizedPhone);

    if (!result.success) {
      return {
        data: null,
        error: new Error(result.message),
      };
    }

    return {
      data: {
        phone: result.phone,
        otp: result.otp ?? null,
        message: result.message,
        devMode: result.devMode,
        fullName,
      },
      error: null,
    };
  }

  const { error } = await supabase.auth.signInWithOtp({
    phone: normalizedPhone,
    options: {
      shouldCreateUser: true,
    },
  });

  if (error) {
    return {
      data: null,
      error: new Error(error.message || "Unable to send OTP."),
    };
  }

  return {
    data: {
      phone: normalizedPhone,
      otp: null,
      message: "OTP sent successfully.",
      devMode: false,
      fullName,
    },
    error: null,
  };
};

export const verifyOtp = async (phone: string, token: string, fullName?: string) => {
  const normalizedPhone = normalizeIndianPhone(phone);

  if (!normalizedPhone) {
    return {
      data: null,
      error: new Error("Enter a valid Indian mobile number."),
    };
  }

  if (process.env.NODE_ENV !== "production") {
    const otpVerification = await verifyDevelopmentOtp(normalizedPhone, token);

    if (!otpVerification.success) {
      return {
        data: null,
        error: new Error(otpVerification.message),
      };
    }

    const finalFullName = sanitizeProfileName(fullName);
    const userId = `dev-user-${normalizedPhone.replace(/\D/g, "")}`;

    await saveProfile(userId, finalFullName, normalizedPhone); 

    const user = {
      id: userId,
      email: null,
      phone: normalizedPhone,
      full_name: finalFullName,
      phone_verified: true,
    };

    const session = {
      access_token: devTokenPayload(user),
      user,
    };

    return {
      data: {
        user,
        session,
        fullName: finalFullName,
        phone: normalizedPhone,
      },
      error: null,
    };
  }

  const { data, error } = await supabase.auth.verifyOtp({
    phone: normalizedPhone,
    token,
    type: "sms",
  });

  if (error || !data?.user || !data?.session) {
    return {
      data: null,
      error: new Error(error?.message || "OTP verification failed."),
    };
  }

  const finalFullName = sanitizeProfileName(fullName ?? data.user.user_metadata?.full_name ?? data.user.user_metadata?.name);

  await saveProfile(data.user.id, finalFullName, normalizedPhone, data.user.email);

  const user = mapSupabaseUser(data.user, finalFullName);

  return {
    data: {
      user,
      session: data.session,
      fullName: finalFullName,
      phone: normalizedPhone,
    },
    error: null,
  };
};

export const registerUser = async (phone: string, fullName?: string) => {
  return requestOtp(phone, fullName);
};

export const loginUser = async (phone: string, otp: string, fullName?: string) => {
  return verifyOtp(phone, otp, fullName);
};

export const getCurrentUser = async (accessToken: string) => {
  if (!accessToken) {
    return { data: null, error: new Error("Authentication required.") };
  }

  const decoded = decodeDevToken(accessToken);

  if (decoded) {
    const user = {
      id: decoded.id,
      email: null,
      phone: decoded.phone,
      user_metadata: {
        full_name: decoded.full_name,
      },
    };

    return {
      data: { user },
      error: null,
    };
  }

  const { data, error } = await supabase.auth.getUser(accessToken);
  return { data, error };
};

export const signOut = async (accessToken: string) => {
  if (!accessToken) {
    return { error: new Error("Authentication required.") };
  }

  if (accessToken.startsWith("dev-token-")) {
    return { error: null };
  }

  const { error } = await supabase.auth.signOut();
  return { error };
};
