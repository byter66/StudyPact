import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
    createDoubt,
    createDoubtReply,
    getDoubts,
    uploadDoubtImages,
} from '../../services/doubtService';
import { supabase } from '../../services/supabaseClient';
import './DoubtForum.css';

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

const formatDoubt = (doubt) => ({
    id: doubt.id,
    author: doubt.authorName || 'StudyPact member',
    text: doubt.content,
    images: doubt.images || [],
    createdAt: doubt.createdAt,
    replies: (doubt.replies || []).map((reply) => ({
        id: reply.id,
        author: reply.authorName || 'StudyPact member',
        text: reply.content,
        createdAt: reply.createdAt,
    })),
});

const DoubtForum = () => {
    const { id } = useParams();

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
                        event: 'INSERT',
                        schema: 'public',
                        table: 'doubts',
                        filter: `room_id=eq.${id}`,
                    },
                    ({ new: newDoubt }) => {
                        if (!newDoubt?.id) return;
                        void replaceDoubtFromServer(newDoubt.id);
                    },
                )
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'doubt_replies',
                    },
                    ({ new: newReply }) => {
                        if (!newReply?.id || !newReply.doubt_id) return;
                        void replaceDoubtFromServer(newReply.doubt_id);
                    },
                );

            channel = subscribedChannel;
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
            if (draftImages.length > 0) {
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
                author: reply.authorName || 'StudyPact member',
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
        } catch (error) {
            setPostError(error.message || 'Unable to post your reply.');
        } finally {
            setReplyingId(null);
        }
    };

    return (
        <div className="df-page">

            <header className="df-topbar">
                <div className="df-room-info">
                    <h1 className="df-title">Doubt Forum</h1>
                </div>
                <Link to={`/study-room/${id}`} className="df-link-btn">Back to room</Link>
            </header>

            <div className="df-body">

                <form className="df-post-card" onSubmit={handlePostDoubt}>
                    <label className="df-field-label" htmlFor="doubt-text">Post a doubt</label>
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
                        <label className="df-upload-btn">
                            📎 {draftImages.length ? `${draftImages.length} image(s) selected` : 'Attach image(s)'}
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
                {loadError && <p className="df-post-error" role="alert">{loadError}</p>}
                {realtimeError && <p className="df-post-error" role="alert">{realtimeError}</p>}

                <div className="df-thread-list">
                    {!loading && !loadError && doubts.map((doubt) => (
                        <article key={doubt.id} className="df-thread">
                            <div className="df-thread-header">
                                <span className="df-avatar">{doubt.author.charAt(0)}</span>
                                <div className="df-thread-meta">
                                    <span className="df-author">{doubt.author}</span>
                                    <span className="df-timestamp">{doubt.createdAt}</span>
                                </div>
                            </div>

                            <p className="df-thread-text">{doubt.text}</p>

                            {doubt.images?.length > 0 && (
                                <div className="df-image-list">
                                    {doubt.images.map((image) => (
                                        <img key={image.id} src={image.url} alt="Attached to doubt" className="df-thread-image" />
                                    ))}
                                </div>
                            )}
                            <div className="df-thread-footer">
                                <button
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
                                            <span className="df-avatar df-avatar-sm">{reply.author.charAt(0)}</span>
                                            <div className="df-reply-body">
                                                <span className="df-reply-meta">
                                                    <span className="df-author">{reply.author}</span>
                                                    <span className="df-timestamp">{reply.createdAt}</span>
                                                </span>
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
                                    />
                                    <button
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
        </div>
    );
};

export default DoubtForum;