import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import './DoubtForum.css';

const ROOMS_BY_ID = {
    r1: { examTag: 'UPSC', title: 'Prelims Revision Pact' },
    r2: { examTag: 'GATE', title: 'CS Core Subjects' },
    r3: { examTag: 'NEET', title: 'Biology Daily Grind' },
    r4: { examTag: 'JEE', title: 'Physics Problem Set' },
};

const INITIAL_DOUBTS = [
    {
        id: 'd1',
        author: 'Kavya',
        text: "Can someone clarify the difference between Article 32 and Article 226? I keep mixing up when each applies.",
        hasImage: false,
        createdAt: '2 hours ago',
        replies: [
            { id: 'd1-r1', author: 'Rahul', text: 'Article 32 is a fundamental right itself (only for FR violations), 226 is broader and available in High Courts.', createdAt: '1 hour ago' },
            { id: 'd1-r2', author: 'Sanjay', text: 'Also 226 covers legal rights too, not just fundamental ones — that\'s the key distinction.', createdAt: '45 min ago' },
        ],
    },
    {
        id: 'd2',
        author: 'Divya',
        text: 'Uploading my handwritten solution for this Polity MCQ — not sure where I went wrong. Attached below.',
        hasImage: true,
        createdAt: '5 hours ago',
        replies: [],
    },
    {
        id: 'd3',
        author: 'Nikhil',
        text: 'What\'s the best way to remember the order of Fundamental Duties?',
        hasImage: false,
        createdAt: '1 day ago',
        replies: [
            { id: 'd3-r1', author: 'Anu', text: 'Try grouping them by theme — nation-related, environment-related, personal conduct. Easier to recall in clusters.', createdAt: '20 hours ago' },
        ],
    },
];

const DoubtForum = () => {
    const { id } = useParams();
    const room = ROOMS_BY_ID[id] || { examTag: 'UPSC', title: 'Study Room' };

    const [doubts, setDoubts] = useState(INITIAL_DOUBTS);
    const [draftText, setDraftText] = useState('');
    const [draftImage, setDraftImage] = useState(null);
    const [replyDrafts, setReplyDrafts] = useState({});
    const [openReplyId, setOpenReplyId] = useState(null);

    const handlePostDoubt = (e) => {
        e.preventDefault();
        if (!draftText.trim()) return;
        const newDoubt = {
            id: `d${Date.now()}`,
            author: 'You',
            text: draftText.trim(),
            hasImage: Boolean(draftImage),
            createdAt: 'just now',
            replies: [],
        };
        setDoubts((prev) => [newDoubt, ...prev]);
        setDraftText('');
        setDraftImage(null);
    };

    const handleReplySubmit = (doubtId) => {
        const text = (replyDrafts[doubtId] || '').trim();
        if (!text) return;
        setDoubts((prev) =>
            prev.map((d) =>
                d.id === doubtId
                    ? { ...d, replies: [...d.replies, { id: `${doubtId}-${Date.now()}`, author: 'You', text, createdAt: 'just now' }] }
                    : d
            )
        );
        setReplyDrafts((prev) => ({ ...prev, [doubtId]: '' }));
        setOpenReplyId(null);
    };

    return (
        <div className="df-page">

            <header className="df-topbar">
                <div className="df-room-info">
                    <span className="df-badge">{room.examTag}</span>
                    <h1 className="df-title">Doubt Forum</h1>
                    <span className="df-room-name">— {room.title}</span>
                </div>
                <Link to={`/study-room/${id}`} className="df-link-btn">Back to room</Link>
            </header>

            <div className="df-body">

                <form className="df-post-card" onSubmit={handlePostDoubt}>
                    <label className="df-field-label" htmlFor="doubt-text">Post a doubt</label>
                    <textarea
                        id="doubt-text"
                        className="df-textarea"
                        placeholder="Type your question..."
                        value={draftText}
                        onChange={(e) => setDraftText(e.target.value)}
                        rows={3}
                    />
                    <div className="df-post-actions">
                        <label className="df-upload-btn">
                            📎 {draftImage ? draftImage.name : 'Attach image'}
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => setDraftImage(e.target.files[0] || null)}
                                hidden
                            />
                        </label>
                        <button type="submit" className="df-btn df-btn-primary">Post doubt</button>
                    </div>
                </form>

                <div className="df-thread-list">
                    {doubts.map((doubt) => (
                        <article key={doubt.id} className="df-thread">
                            <div className="df-thread-header">
                                <span className="df-avatar">{doubt.author.charAt(0)}</span>
                                <div className="df-thread-meta">
                                    <span className="df-author">{doubt.author}</span>
                                    <span className="df-timestamp">{doubt.createdAt}</span>
                                </div>
                            </div>

                            <p className="df-thread-text">{doubt.text}</p>

                            {doubt.hasImage && (
                                <div className="df-image-placeholder">
                                    🖼 Attached image
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
                                            if (e.key === 'Enter') handleReplySubmit(doubt.id);
                                        }}
                                    />
                                    <button
                                        className="df-btn df-btn-outline"
                                        onClick={() => handleReplySubmit(doubt.id)}
                                    >
                                        Reply
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