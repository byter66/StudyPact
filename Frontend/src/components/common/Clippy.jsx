import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './Clippy.css';

const CLIPPY_TIPS = {
  dashboard: [
    "Pick a goal for today and you'll be ready to go!",
    'Every study day adds to your streak. You’ve got this!',
    'Join a room and make studying a team effort.',
    'Ready to study together? Start a room for your group!',
  ],
  studyRoom: [
    'Choose a study time that feels right. Your default is 20 minutes!',
    'Your teammates show up here as they join. Great to have company!',
    'Got a question? Tap ? and your group can help you out.',
    'Tap the chat button to share a thought with your study group.',
    'Little steps add up. Your daily tasks are here when you need them!',
  ],
  mockRoom: [
    'Your mock test timer stays in sync for everyone. You’ve got this!',
    'Remember to submit your paper before time is up.',
    'Once you submit, you can help a teammate by reviewing their work.',
    'Stuck on a question? The Doubt Forum is there to help.',
  ],
  evaluation: [
    'Take a look through your teammate’s answers. Your feedback helps!',
    'Use the rubric as a guide while you score each answer.',
    'A short comment can make your feedback extra helpful.',
    'Not sure about a question? Pop into the Doubt Forum for a hand.',
  ],
  doubtForum: [
    'Ask away! Your study group is here to figure it out together.',
    'A picture can help explain it. Attach one whenever you like.',
    'Open a question to see what your group has added. Happy learning!',
  ],
};

export default function Clippy({ context }) {
  const tips = CLIPPY_TIPS[context];
  const [open, setOpen] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    setOpen(false);
    setTipIndex(0);
  }, [context]);

  if (!tips) return null;

  return createPortal((
    <aside className={`clippy-guide${open ? ' is-open' : ''}`}>
      {open ? (
        <div className="clippy-bubble" role="status" aria-live="polite">
          <p>{tips[tipIndex % tips.length]}</p>
          {tips.length > 1 ? (
            <button
              type="button"
              className="clippy-next"
              onClick={() => setTipIndex((index) => (index + 1) % tips.length)}
            >
              Next tip
            </button>
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        className="clippy-character"
        aria-label={open ? 'Close StudyPact guide' : 'Open StudyPact guide'}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <svg className="clippy-clip" viewBox="0 0 64 84" aria-hidden="true">
          <path
            d="M39 16v40a13 13 0 0 1-26 0V17a9 9 0 0 1 18 0v36a4 4 0 0 1-8 0V21"
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="24" cy="36" r="2.1" className="clippy-eye" />
          <circle cx="33" cy="36" r="2.1" className="clippy-eye" />
          <path d="M25 42q3 3 6 0" className="clippy-smile" />
        </svg>
        <span className="clippy-name">Clippy</span>
      </button>
    </aside>
  ), document.body);
}
