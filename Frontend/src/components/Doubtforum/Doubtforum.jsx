import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
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

const readImage = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
        data: String(reader.result).split(',')[1],
        mimeType: file.type,
    });
    reader.onerror = () => reject(new Error('Unable to read the selected image.'));
    reader.readAsDataURL(file);
});

const formatTimeAgo = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
};

const formatDoubt = (doubt) => ({
    id: doubt.id,
    userId: doubt.userId,
    author: doubt.authorName || 'Student',
    text: doubt.content,
    images: doubt.images || [],
    createdAt: formatTimeAgo(doubt.createdAt),
    rawCreatedAt: doubt.createdAt,
    replies: (doubt.replies || []).map((reply) => ({
        id: reply.id,
        userId: reply.userId,
        author: reply.authorName || 'Student',
        text: reply.content,
        createdAt: formatTimeAgo(reply.createdAt),
        rawCreatedAt: reply.createdAt,
    })),
});

function DoubtForumInner() {
    const { id, roomId } = useParams();
    const currentRoomId = id || roomId;
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
    const [lightboxImage, setLightboxImage] = useState(null);
    const realtimeRetryTimerRef = useRef(null);
    const realtimeRetryCountRef = useRef(0);
    const channelRef = useRef(null);

    // Mark replies as read on mount
    useEffect(() => {
        try {
            const session = localStorage.getItem('studypact-session');
            const parsed = session ? JSON.parse(session) : null;
            const currentUserId = parsed?.user?.id;
            if (currentUserId && currentRoomId) {
                localStorage.setItem(`doubt_last_read_${currentUserId}_${currentRoomId}`, new Date().toISOString());
            }
        } catch {}
    }, [currentRoomId]);

    const loadDoubts = async () => {
        setLoading(true);
        setLoadError('');

        try {
            const fetchedDoubts = await getDoubts(currentRoomId);
            setDoubts(fetchedDoubts.map(formatDoubt));
            setRealtimeError('');
        } catch (error) {
            setLoadError(error.message || 'Unable to load doubts.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let isCurrent = true;
        let channel = null;

        const replaceDoubtFromServer = async (doubtId) => {
            try {
                const fetchedDoubts = await getDoubts(currentRoomId);
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
                .channel(`doubt-forum:${currentRoomId}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'doubts',
                        filter: `room_id=eq.${currentRoomId}`,
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

        const init = async () => {
            setLoading(true);
            setLoadError('');

            try {
                const fetchedDoubts = await getDoubts(currentRoomId);
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

        void init();

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
    }, [currentRoomId]);

    const handlePostDoubt = async (e) => {
        e.preventDefault();
        const content = draftText.trim();
        if (!content || posting) return;

        setPosting(true);
        setPostError('');

        try {
            const doubt = await createDoubt(currentRoomId, content);
            let images = [];
            if (draftImages.length > 0) {
                setUploading(true);
                const imagePayloads = await Promise.all(draftImages.map(readImage));
                images = await uploadDoubtImages(currentRoomId, doubt.id, imagePayloads);
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
                event: 'doubt-posted',
                payload: { doubtId: doubt.id },
            })?.catch(() => {});
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
            const reply = await createDoubtReply(currentRoomId, doubtId, text);
            const formattedReply = {
                id: reply.id,
                author: reply.authorName || 'Student',
                text: reply.content,
                createdAt: 'just now',
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
            })?.catch(() => {});
        } catch (error) {
            setPostError(error.message || 'Unable to post your reply.');
        } finally {
            setReplyingId(null);
        }
    };

    const backPath = returnTo || `/study-room/${currentRoomId}`;

    return (
        <div className="df-page">
            <header className="df-topbar">
                <div className="df-room-info">
                    <h1 className="df-title">
                        Doubt Forum <span className="df-title-sep">— Study Room</span>
                    </h1>
                </div>
                <div className="df-topbar-actions">
                    <Link
                        to={backPath}
                        state={{ assignmentId, savedScores, savedComments }}
                        className="df-link-btn"
                    >
                        Back to room
                    </Link>
                </div>
            </header>

            <div className="df-body">
                {loadError && (
                    <div className="df-recovery-banner" role="alert">
                        <p className="df-error-text">{loadError}</p>
                        <div className="df-recovery-actions">
                            <button
                                type="button"
                                onClick={() => void loadDoubts()}
                                className="df-btn df-btn-outline"
                            >
                                ↻ Refresh Room
                            </button>
                            <Link to={backPath} className="df-btn df-btn-primary">
                                Return to Study Room
                            </Link>
                        </div>
                    </div>
                )}

                <form className="df-post-card" onSubmit={handlePostDoubt}>
                    <label className="df-field-label" htmlFor="doubt-text">POST A DOUBT</label>
                    {postError && <p className="df-post-error" role="alert">{postError}</p>}
                    <textarea
                        id="doubt-text"
                        className="df-textarea"
                        placeholder="Type your question..."
                        value={draftText}
                        onChange={(e) => setDraftText(e.target.value)}
                        rows={3}
                        maxLength={5000}
                        disabled={posting}
                    />
                    <div className="df-post-actions">
                        <div className="df-post-actions-left">
                            <label className={`df-upload-btn ${posting ? 'disabled' : ''}`}>
                                📎 {draftImages.length ? `${draftImages.length} image(s) selected` : 'Attach image'}
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
                                <div className="df-selected-images">
                                    {draftImages.map((file) => (
                                        <span key={`${file.name}-${file.lastModified}`} className="df-selected-image">
                                            {file.name}
                                            <button
                                                type="button"
                                                aria-label={`Remove ${file.name}`}
                                                onClick={() => setDraftImages((current) => current.filter((item) => item !== file))}
                                                disabled={posting}
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            type="submit"
                            className="df-btn df-btn-primary"
                            disabled={posting || !draftText.trim()}
                        >
                            {uploading ? 'Uploading...' : posting ? 'Posting...' : 'Post doubt'}
                        </button>
                    </div>
                </form>

                {loading && <p className="df-state" role="status">Loading doubts...</p>}
                {realtimeError && <p className="df-realtime-note" role="status">{realtimeError}</p>}

                <div className="df-thread-list">
                    {!loading && !loadError && doubts.map((doubt) => (
                        <article key={doubt.id} className="df-thread">
                            <div className="df-thread-header">
                                <span className="df-avatar">{doubt.author.charAt(0).toUpperCase()}</span>
                                <div className="df-thread-meta">
                                    <span className="df-author">{doubt.author}</span>
                                    <span className="df-timestamp">{doubt.createdAt}</span>
                                </div>
                            </div>

                            <p className="df-thread-text">{doubt.text}</p>

                            {doubt.images?.length > 0 && (
                                <div className="df-image-list">
                                    {doubt.images.map((image) => (
                                        <div
                                            key={image.id}
                                            className="df-attached-image-card"
                                            onClick={() => setLightboxImage(image.url)}
                                            title="Click to view image"
                                        >
                                            <img
                                                src={image.url}
                                                alt="Attached to doubt"
                                                className="df-thread-image"
                                            />
                                            <span className="df-attached-image-tag">🖼️ Attached image</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="df-thread-footer">
                                <button
                                    type="button"
                                    className="df-reply-toggle"
                                    onClick={() => setOpenReplyId(openReplyId === doubt.id ? null : doubt.id)}
                                >
                                    {doubt.replies.length} {doubt.replies.length === 1 ? 'reply' : 'replies'}
                                </button>
                            </div>

                            {doubt.replies.length > 0 && (
                                <div className="df-replies">
                                    {doubt.replies.map((reply) => (
                                        <div key={reply.id} className="df-reply">
                                            <span className="df-avatar df-avatar-sm">{reply.author.charAt(0).toUpperCase()}</span>
                                            <div className="df-reply-body">
                                                <div className="df-reply-meta">
                                                    <span className="df-author">{reply.author}</span>
                                                    <span className="df-timestamp">{reply.createdAt}</span>
                                                </div>
                                                <p className="df-reply-text">{reply.text}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {openReplyId === doubt.id && (
                                <div className="df-reply-form">
                                    <input
                                        type="text"
                                        className="df-reply-input"
                                        placeholder="Write a reply..."
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
                                        className="df-btn df-btn-outline"
                                        onClick={() => void handleReplySubmit(doubt.id)}
                                        disabled={replyingId === doubt.id || !(replyDrafts[doubt.id] || '').trim()}
                                    >
                                        {replyingId === doubt.id ? 'Replying...' : 'Reply'}
                                    </button>
                                </div>
                            )}
                        </article>
                    ))}
                </div>
            </div>

            {/* Lightbox */}
            {lightboxImage && (
                <div className="df-lightbox" onClick={() => setLightboxImage(null)}>
                    <div className="df-lightbox-content" onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            className="df-lightbox-close"
                            onClick={() => setLightboxImage(null)}
                            aria-label="Close"
                        >
                            ×
                        </button>
                        <img src={lightboxImage} alt="Full view" className="df-lightbox-img" />
                    </div>
                </div>
            )}
        </div>
    );
}

class DoubtErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(error) {
        console.error('DoubtForum caught error:', error);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="df-page">
                    <div className="df-recovery-banner" role="alert">
                        <p className="df-error-text">Unable to render Doubt Forum content.</p>
                        <Link to={`/study-room/${this.props.roomId || ''}`} className="df-btn df-btn-primary">
                            Return to Study Room
                        </Link>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

export default function DoubtForum() {
    const { id, roomId } = useParams();
    const currentRoomId = id || roomId;
    return (
        <DoubtErrorBoundary roomId={currentRoomId}>
            <DoubtForumInner />
        </DoubtErrorBoundary>
    );
}
