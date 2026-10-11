import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
    ArrowLeft,
    Paperclip,
    Send,
    MessageSquare,
    Clock,
    X,
    Image as ImageIcon,
    Shield,
} from 'lucide-react';
import {
    createDoubt,
    createDoubtReply,
    getDoubts,
    uploadDoubtImages,
} from '../../services/doubtService';
import { supabase } from '../../services/supabaseClient';
import './Doubtforum.css';

const MAX_IMAGE_COUNT = 3;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
]);

const QUICK_QUERY_TOPICS = [
    'Syllabus Interpretation',
    'PYQ Derivation',
    'Formula Clarification',
    'Ethics Case Analysis',
];

const readImage = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
        data: String(reader.result).split(',')[1],
        mimeType: file.type,
    });
    reader.onerror = () => reject(new Error('Unable to read the selected image.'));
    reader.readAsDataURL(file);
});

const formatDoubt = (doubt) => ({
    id: doubt.id,
    author: doubt.authorName || 'Student',
    text: doubt.content,
    images: doubt.images || [],
    createdAt: doubt.createdAt,
    replies: (doubt.replies || []).map((reply) => ({
        id: reply.id,
        author: reply.authorName || 'Student',
        text: reply.content,
        createdAt: reply.createdAt,
    })),
});

const DoubtForum = () => {
    const { id } = useParams();
    const location = useLocation();
    const returnTo = location.state?.returnTo;
    const assignmentId = location.state?.assignmentId;
    const savedScores = location.state?.savedScores;
    const savedComments = location.state?.savedComments;

    const [doubts, setDoubts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [realtimeError, setRealtimeError] = useState('');
    const [draftText, setDraftText] = useState('');
    const [draftImages, setDraftImages] = useState([]);
    const [posting, setPosting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [replyingId, setReplyingId] = useState(null);
    const [postError, setPostError] = useState('');
    const [replyDrafts, setReplyDrafts] = useState({});
    const [openReplyId, setOpenReplyId] = useState(null);
    const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'unanswered' | 'with_images'
    const [activeLightboxImg, setActiveLightboxImg] = useState(null);
    const realtimeRetryTimerRef = useRef(null);
    const realtimeRetryCountRef = useRef(0);

    useEffect(() => {
        let isCurrent = true;
        let channel = null;

        const replaceDoubtFromServer = async (doubtId) => {
            try {
                const fetchedDoubts = await getDoubts(id);
                if (!isCurrent) return;

                const formattedDoubts = fetchedDoubts.map(formatDoubt);
                if (doubtId && !formattedDoubts.some((doubt) => doubt.id === doubtId)) {
                    return;
                }

                setDoubts(formattedDoubts);
                setRealtimeError('');
            } catch (error) {
                if (isCurrent) {
                    setRealtimeError(error.message || 'Unable to resynchronize forum updates.');
                }
            }
        };

        const subscribeToDoubtUpdates = () => {
            if (!isCurrent) return;
            if (!supabase) {
                setRealtimeError('Realtime is not configured for this environment.');
                return;
            }

            const subscribedChannel = supabase
                .channel(`doubt-forum:${id}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'doubts',
                        filter: `room_id=eq.${id}`,
                    },
                    ({ new: newDoubt }) => {
                        void replaceDoubtFromServer(newDoubt?.id);
                    },
                )
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'doubt_replies',
                    },
                    ({ new: newReply }) => {
                        void replaceDoubtFromServer(newReply?.doubt_id);
                    },
                )
                .on('broadcast', { event: 'doubt-posted' }, ({ payload }) => {
                    void replaceDoubtFromServer(payload?.doubtId);
                })
                .on('broadcast', { event: 'doubt-updated' }, ({ payload }) => {
                    void replaceDoubtFromServer(payload?.doubtId);
                })
                .on('broadcast', { event: 'reply-added' }, ({ payload }) => {
                    void replaceDoubtFromServer(payload?.doubtId);
                });

            channel = subscribedChannel;
            channelRef.current = subscribedChannel;
            subscribedChannel.subscribe((status) => {
                if (!isCurrent) return;

                if (status === 'SUBSCRIBED') {
                    return;
                }

                if (
                    status !== 'CHANNEL_ERROR' &&
                    status !== 'TIMED_OUT' &&
                    status !== 'CLOSED'
                ) {
                    return;
                }

                if (
                    realtimeRetryCountRef.current >= 3 ||
                    realtimeRetryTimerRef.current
                ) return;
                realtimeRetryCountRef.current += 1;
                const retryDelay = realtimeRetryCountRef.current * 1000;
                realtimeRetryTimerRef.current = window.setTimeout(async () => {
                    realtimeRetryTimerRef.current = null;
                    if (!isCurrent) return;
                    await supabase.removeChannel(subscribedChannel);
                    await replaceDoubtFromServer();
                    subscribeToDoubtUpdates();
                }, retryDelay);
            });
        };

        const loadDoubts = async () => {
            setLoading(true);
            setLoadError('');

            try {
                const fetchedDoubts = await getDoubts(id);
                if (!isCurrent) return;

                setDoubts(fetchedDoubts.map(formatDoubt));
                setRealtimeError('');
                subscribeToDoubtUpdates();
            } catch (error) {
                if (isCurrent) {
                    setLoadError(error.message || 'Unable to load doubts.');
                }
            } finally {
                if (isCurrent) {
                    setLoading(false);
                }
            }
        };

        void loadDoubts();

        return () => {
            isCurrent = false;
            if (realtimeRetryTimerRef.current) {
                window.clearTimeout(realtimeRetryTimerRef.current);
            }
            realtimeRetryTimerRef.current = null;
            realtimeRetryCountRef.current = 0;
            channelRef.current = null;
            if (channel) {
                void supabase?.removeChannel(channel);
            }
        };
    }, [id]);

    const handlePostDoubt = async (e) => {
        e.preventDefault();
        const content = draftText.trim();
        if (!content || posting) return;

        setPosting(true);
        setPostError('');

        try {
            const doubt = await createDoubt(id, content);
            let images = [];
            const hasImages = draftImages.length > 0;
            if (hasImages) {
                setUploading(true);
                const imagePayloads = await Promise.all(draftImages.map(readImage));
                images = await uploadDoubtImages(id, doubt.id, imagePayloads);
            }
            setDoubts((prev) => [{
                id: doubt.id,
                author: 'You',
                text: doubt.content,
                images,
                createdAt: 'just now',
                replies: [],
            }, ...prev]);
            setDraftText('');
            setDraftImages([]);
            void channelRef.current?.send({
                type: 'broadcast',
                event: hasImages ? 'doubt-updated' : 'doubt-posted',
                payload: { doubtId: doubt.id },
            })?.catch((broadcastError) => {
                console.error('Unable to broadcast doubt:', broadcastError);
            });
        } catch (error) {
            setPostError(error.message || 'Unable to post your doubt.');
        } finally {
            setUploading(false);
            setPosting(false);
        }
    };

    const handleImageChange = (event) => {
        const selectedFiles = Array.from(event.target.files || []);
        if (!selectedFiles.length) return;

        if (selectedFiles.length > MAX_IMAGE_COUNT) {
            setPostError(`You can attach up to ${MAX_IMAGE_COUNT} images.`);
            event.target.value = '';
            return;
        }

        const invalidFile = selectedFiles.find((file) => (
            !ALLOWED_IMAGE_TYPES.has(file.type) || file.size > MAX_IMAGE_BYTES
        ));
        if (invalidFile) {
            setPostError('Images must be JPEG, PNG, WebP, or GIF files of 3 MB or less.');
            event.target.value = '';
            return;
        }

        setPostError('');
        setDraftImages(selectedFiles);
    };

    const handleReplySubmit = async (doubtId) => {
        const text = (replyDrafts[doubtId] || '').trim();
        const doubt = doubts.find((item) => item.id === doubtId);
        if (!text || !doubt || replyingId === doubtId) return;

        setReplyingId(doubtId);
        setPostError('');

        try {
            const reply = await createDoubtReply(id, doubtId, text);
            const formattedReply = {
                id: reply.id,
                author: reply.authorName || 'Student',
                text: reply.content,
                createdAt: reply.createdAt,
            };
            setDoubts((prev) =>
                prev.map((d) =>
                    d.id === doubtId
                        ? { ...d, replies: [...d.replies, formattedReply] }
                        : d
                )
            );
            setReplyDrafts((prev) => ({ ...prev, [doubtId]: '' }));
            setOpenReplyId(null);
            void channelRef.current?.send({
                type: 'broadcast',
                event: 'reply-added',
                payload: { doubtId },
            })?.catch((broadcastError) => {
                console.error('Unable to broadcast doubt reply:', broadcastError);
            });
        } catch (error) {
            setPostError(error.message || 'Unable to post your reply.');
        } finally {
            setReplyingId(null);
        }
    };

    const filteredDoubts = doubts.filter((d) => {
        if (activeFilter === 'unanswered') return d.replies.length === 0;
        if (activeFilter === 'with_images') return d.images && d.images.length > 0;
        return true;
    });

    return (
        <div className="sp-tribunal-page">
            {/* ================================================================
                TOP TRIBUNAL COCKPIT BAR
                ================================================================ */}
            <header className="sp-tribunal-bar">
                <div className="sp-tribunal-bar-left">
                    {returnTo ? (
                        <Link
                            to={returnTo}
                            state={{ assignmentId, savedScores, savedComments }}
                            className="sp-tribunal-back-btn"
                        >
                            <ArrowLeft size={16} />
                            <span>Back to Evaluation</span>
                        </Link>
                    ) : (
                        <Link to={`/study-room/${id}`} className="sp-tribunal-back-btn">
                            <ArrowLeft size={16} />
                            <span>Back to Study Room</span>
                        </Link>
                    )}
                    <div className="sp-tribunal-chamber-tag">
                        ROOM #{id?.slice(0, 8) || 'MAIN'}
                    </div>
                </div>

                <div className="sp-tribunal-bar-center">
                    <span className="sp-tribunal-seal">?</span>
                    <div>
                        <h1 className="sp-tribunal-title">Doubt Forum</h1>
                        <span className="sp-tribunal-sub">Ask Questions & Learn Together</span>
                    </div>
                </div>

                <div className="sp-tribunal-bar-right">
                    <div className="sp-tribunal-metric-badge">
                        <MessageSquare size={13} />
                        <span>{doubts.length} Doubts Posted</span>
                    </div>
                </div>
            </header>

            {/* ================================================================
                DUAL-WING TRIBUNAL WORKSPACE
                ================================================================ */}
            <div className="sp-tribunal-workspace">
                {/* ============================================================
                    LEFT WING: LODGING STUDIO & CANONS (~380px STICKY)
                    ============================================================ */}
                <aside className="sp-tribunal-left-wing">
                    {/* Inquiry Submission Box */}
                    <div className="sp-inquiry-box">
                        <div className="sp-inquiry-header">
                            <span className="sp-inquiry-eyebrow">STUDY ROOM Q&A</span>
                            <h3 className="sp-inquiry-title">Ask a Question</h3>
                            <p className="sp-inquiry-sub">
                                Have a doubt about a problem or concept? Ask your study group here.
                            </p>
                        </div>

                        {postError && (
                            <div className="sp-notice sp-notice-alert sp-inquiry-notice" role="alert">
                                {postError}
                            </div>
                        )}

                        <form className="sp-inquiry-form" onSubmit={handlePostDoubt}>
                            <textarea
                                id="doubt-text"
                                className="sp-inquiry-textarea"
                                placeholder="Explain what you are stuck on, mention the topic/source, and share your attempt..."
                                value={draftText}
                                onChange={(e) => setDraftText(e.target.value)}
                                rows={4}
                                maxLength={5000}
                                disabled={posting}
                            />

                            {/* Image Attachment Dropzone */}
                            <div className="sp-attachment-area">
                                <label className={`sp-attach-trigger ${posting ? 'disabled' : ''}`}>
                                    <Paperclip size={14} />
                                    <span>
                                        {draftImages.length
                                            ? `${draftImages.length} of ${MAX_IMAGE_COUNT} Image(s) Attached`
                                            : 'Attach images or diagrams (Max 3)'}
                                    </span>
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp,image/gif"
                                        multiple
                                        onChange={handleImageChange}
                                        disabled={posting}
                                        hidden
                                    />
                                </label>

                                {draftImages.length > 0 && (
                                    <div className="sp-attached-chips">
                                        {draftImages.map((file) => (
                                            <span
                                                key={`${file.name}-${file.lastModified}`}
                                                className="sp-attached-chip"
                                            >
                                                <ImageIcon size={11} />
                                                <span className="sp-chip-name">{file.name}</span>
                                                <button
                                                    type="button"
                                                    className="sp-chip-remove"
                                                    aria-label={`Remove ${file.name}`}
                                                    onClick={() =>
                                                        setDraftImages((current) =>
                                                            current.filter((item) => item !== file)
                                                        )
                                                    }
                                                    disabled={posting}
                                                >
                                                    <X size={11} />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Quick Topic Helpers */}
                            <div className="sp-quick-topics">
                                <span className="sp-quick-label">Subject tags:</span>
                                <div className="sp-quick-tag-row">
                                    {QUICK_QUERY_TOPICS.map((topic) => (
                                        <button
                                            type="button"
                                            key={topic}
                                            className="sp-quick-tag"
                                            onClick={() => setDraftText((prev) => prev ? `${prev} [${topic}] ` : `[${topic}] `)}
                                        >
                                            + {topic}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="sp-btn sp-btn-primary sp-submit-inquiry-btn"
                                disabled={posting || !draftText.trim()}
                            >
                                <Send size={14} />
                                <span>{uploading ? 'Uploading images...' : posting ? 'Posting doubt...' : 'Post Doubt'}</span>
                            </button>
                        </form>
                    </div>

                    {/* Canons & Guidelines Box */}
                    <div className="sp-canons-box">
                        <div className="sp-canons-header">
                            <Shield size={16} className="sp-canons-icon" />
                            <h4 className="sp-canons-title">Tips for Asking Questions</h4>
                        </div>
                        <ul className="sp-canons-list">
                            <li>
                                <strong>Tip 1:</strong> Mention the specific concept or question source.
                            </li>
                            <li>
                                <strong>Tip 2:</strong> Share what you have tried so others understand your doubt.
                            </li>
                            <li>
                                <strong>Tip 3:</strong> Reply or confirm once your doubt is resolved.
                            </li>
                        </ul>
                    </div>
                </aside>

                {/* ============================================================
                    RIGHT WING: THE INQUIRY DOCKET & RESOLUTION STREAM (FLUID)
                    ============================================================ */}
                <main className="sp-tribunal-docket">
                    {/* Docket Header & Filter Bar */}
                    <div className="sp-docket-toolbar">
                        <div className="sp-docket-tabs">
                            <button
                                type="button"
                                className={`sp-docket-tab ${activeFilter === 'all' ? 'active' : ''}`}
                                onClick={() => setActiveFilter('all')}
                            >
                                All Doubts ({doubts.length})
                            </button>
                            <button
                                type="button"
                                className={`sp-docket-tab ${activeFilter === 'unanswered' ? 'active' : ''}`}
                                onClick={() => setActiveFilter('unanswered')}
                            >
                                Unanswered ({doubts.filter(d => d.replies.length === 0).length})
                            </button>
                            <button
                                type="button"
                                className={`sp-docket-tab ${activeFilter === 'with_images' ? 'active' : ''}`}
                                onClick={() => setActiveFilter('with_images')}
                            >
                                With Images ({doubts.filter(d => d.images?.length > 0).length})
                            </button>
                        </div>
                    </div>

                    {loading && (
                        <div className="sp-docket-loading">
                            <div className="sp-spinner"></div>
                            <span>Loading doubts...</span>
                        </div>
                    )}

                    {loadError && (
                        <div className="sp-notice sp-notice-alert" role="alert">
                            {loadError}
                        </div>
                    )}

                    {realtimeError && (
                        <div className="sp-notice sp-notice-info" role="status">
                            {realtimeError}
                        </div>
                    )}

                    {!loading && !loadError && (
                        <div className="sp-docket-feed">
                            {filteredDoubts.map((doubt, idx) => {
                                const hasReplies = doubt.replies.length > 0;
                                const isReplying = openReplyId === doubt.id;

                                return (
                                    <article key={doubt.id} className="sp-query-dossier">
                                        {/* Query Dossier Header */}
                                        <div className="sp-query-header">
                                            <div className="sp-query-author-block">
                                                <div className="sp-query-avatar">
                                                    {doubt.author.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="sp-query-author-meta">
                                                    <span className="sp-query-author-name">{doubt.author}</span>
                                                    <span className="sp-query-time">
                                                        <Clock size={11} /> {doubt.createdAt}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="sp-query-status-badge">
                                                <span className="sp-query-serial">#{String(idx + 1).padStart(2, '0')}</span>
                                                <span className={`sp-status-tag ${hasReplies ? 'resolved' : 'pending'}`}>
                                                    {hasReplies ? 'ANSWERED' : 'UNANSWERED'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Query Main Body */}
                                        <p className="sp-query-text">{doubt.text}</p>

                                        {/* Attached Diagrams Gallery */}
                                        {doubt.images?.length > 0 && (
                                            <div className="sp-query-gallery">
                                                {doubt.images.map((image, imgIdx) => (
                                                    <div
                                                        key={image.id || imgIdx}
                                                        className="sp-gallery-thumb-wrap"
                                                        onClick={() => setActiveLightboxImg(image.url)}
                                                        title="Click to examine full diagram"
                                                    >
                                                        <img
                                                            src={image.url}
                                                            alt="Attached problem diagram"
                                                            className="sp-gallery-thumb"
                                                        />
                                                        <span className="sp-gallery-zoom-hint">View full image ↗</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Query Footer & Reply Toggle */}
                                        <div className="sp-query-footer">
                                            <button
                                                type="button"
                                                className="sp-replies-counter-btn"
                                                onClick={() => setOpenReplyId(isReplying ? null : doubt.id)}
                                            >
                                                <MessageSquare size={14} />
                                                <span>
                                                    {doubt.replies.length} {doubt.replies.length === 1 ? 'Reply' : 'Replys'}
                                                </span>
                                                <span className="sp-counter-action">
                                                    {isReplying ? 'Collapse ↑' : 'Reply ↓'}
                                                </span>
                                            </button>
                                        </div>

                                        {/* Discussion / Responses Feed */}
                                        {doubt.replies.length > 0 && (
                                            <div className="sp-responses-feed">
                                                {doubt.replies.map((reply, rIdx) => (
                                                    <div key={reply.id || rIdx} className="sp-response-card">
                                                        <div className="sp-response-avatar">
                                                            {reply.author.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="sp-response-content">
                                                            <div className="sp-response-meta">
                                                                <span className="sp-response-author">{reply.author}</span>
                                                                <span className="sp-response-time">{reply.createdAt}</span>
                                                            </div>
                                                            <p className="sp-response-text">{reply.text}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Inline Resolution Composer */}
                                        {isReplying && (
                                            <div className="sp-inline-reply-tray">
                                                <input
                                                    type="text"
                                                    className="sp-inline-reply-input"
                                                    placeholder="Write your reply or solution..."
                                                    value={replyDrafts[doubt.id] || ''}
                                                    onChange={(e) =>
                                                        setReplyDrafts((prev) => ({ ...prev, [doubt.id]: e.target.value }))
                                                    }
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') void handleReplySubmit(doubt.id);
                                                    }}
                                                    disabled={replyingId === doubt.id}
                                                    autoFocus
                                                />
                                                <button
                                                    type="button"
                                                    className="sp-btn sp-btn-primary sp-btn-sm"
                                                    onClick={() => void handleReplySubmit(doubt.id)}
                                                    disabled={replyingId === doubt.id || !(replyDrafts[doubt.id] || '').trim()}
                                                >
                                                    {replyingId === doubt.id ? 'Submitting...' : 'Post Reply'}
                                                </button>
                                            </div>
                                        )}
                                    </article>
                                );
                            })}

                            {filteredDoubts.length === 0 && (
                                <div className="sp-docket-empty">
                                    <div className="sp-empty-case-monogram">§</div>
                                    <h3 className="sp-empty-case-title">No doubts posted yet</h3>
                                    <p className="sp-empty-case-sub">
                                        No questions found for this filter. Ask the first doubt using the form on the left!
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>

            {/* Lightbox Modal */}
            {activeLightboxImg && (
                <div className="sp-lightbox-overlay" onClick={() => setActiveLightboxImg(null)}>
                    <div className="sp-lightbox-container" onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            className="sp-lightbox-close"
                            onClick={() => setActiveLightboxImg(null)}
                            aria-label="Close diagram"
                        >
                            <X size={20} />
                        </button>
                        <img src={activeLightboxImg} alt="Magnified diagram" className="sp-lightbox-img" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default DoubtForum;
