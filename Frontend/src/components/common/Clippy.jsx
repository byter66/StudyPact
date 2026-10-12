import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './Clippy.css';

const CLIPPY_TIPS = {
  dashboard: [
    { text: "Pick a goal for today and you'll be ready to go!", target: 'dashboard-goals' },
    { text: 'Every study day adds to your streak. You’ve got this!', target: 'dashboard-streak' },
    { text: 'Join a room and make studying a team effort.', target: 'dashboard-join-room' },
    { text: 'Already have a room code? Pop it in here and join your study group!', target: 'dashboard-room-code' },
    { text: 'Ready to study together? Start a room for your group!', target: 'dashboard-create-room' },
  ],
  studyRoom: [
    { text: 'Choose a study time that feels right. Your default is 20 minutes!', target: 'study-timer' },
    { text: 'Your teammates show up here as they join. Great to have company!', target: 'study-members' },
    { text: 'Got a question? Tap ? and your group can help you out.', target: 'study-doubt-forum' },
    { text: 'Tap the chat button to share a thought with your study group.', target: 'study-chat' },
    { text: 'Little steps add up. Your daily tasks are here when you need them!', target: 'study-tasks' },
  ],
  mockRoom: [
    { text: 'Your mock test timer stays in sync for everyone. You’ve got this!', target: 'mock-timer' },
    { text: 'Remember to submit your paper before time is up.', target: 'mock-submit' },
    { text: 'Once you submit, you can help a teammate by reviewing their work.', target: 'mock-review' },
    { text: 'Stuck on a question? The Doubt Forum is there to help.', target: 'mock-doubt-forum' },
  ],
  evaluation: [
    { text: 'Take a look through your teammate’s answers. Your feedback helps!', target: 'evaluation-answer' },
    { text: 'Use the rubric as a guide while you score each answer.', target: 'evaluation-rubric' },
    { text: 'A short comment can make your feedback extra helpful.', target: 'evaluation-comments' },
    { text: 'Not sure about a question? Pop into the Doubt Forum for a hand.', target: 'mock-doubt-forum' },
  ],
  doubtForum: [
    { text: 'Ask away! Your study group is here to figure it out together.', target: 'doubt-composer' },
    { text: 'A picture can help explain it. Attach one whenever you like.', target: 'doubt-image-upload' },
    { text: 'Open a question to see what your group has added. Happy learning!', target: 'doubt-list' },
  ],
};

const HIGHLIGHT_CLASS = 'clippy-feature-highlight';

const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

export default function Clippy({ context }) {
  const tips = CLIPPY_TIPS[context];
  const [open, setOpen] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [tourActive, setTourActive] = useState(false);
  const [tourCompleted, setTourCompleted] = useState(false);
  const [position, setPosition] = useState(null);
  const guideRef = useRef(null);

  useEffect(() => {
    setOpen(false);
    setTipIndex(0);
    setTourActive(false);
    setTourCompleted(false);
    setPosition(null);
  }, [context]);

  const tip = tips?.[tipIndex];

  useEffect(() => {
    const guide = guideRef.current;
    if (!open || !tourActive || !tip?.target || !guide) {
      setPosition(null);
      return undefined;
    }

    const target = document.querySelector(`[data-clippy-target="${tip.target}"]`);
    if (!target) {
      setPosition(null);
      return undefined;
    }

    target.classList.add(HIGHLIGHT_CLASS);
    const highlightTimer = window.setTimeout(() => target.classList.remove(HIGHLIGHT_CLASS), 1300);
    const guideRect = guide.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const gap = 12;
    const canFitRight = window.innerWidth - targetRect.right >= guideRect.width + gap * 2;
    const canFitLeft = targetRect.left >= guideRect.width + gap * 2;
    let left;
    let top;
    let placeVertically = false;

    if (canFitRight) {
      left = targetRect.right + gap;
    } else if (canFitLeft) {
      left = targetRect.left - guideRect.width - gap;
    } else {
      left = clamp(targetRect.left + targetRect.width / 2 - guideRect.width / 2, gap, window.innerWidth - guideRect.width - gap);
      placeVertically = true;
    }

    if (placeVertically && window.innerHeight - targetRect.bottom >= guideRect.height + gap * 2) {
      top = targetRect.bottom + gap;
    } else if (placeVertically && targetRect.top >= guideRect.height + gap * 2) {
      top = targetRect.top - guideRect.height - gap;
    } else {
      top = clamp(
        targetRect.top + targetRect.height / 2 - guideRect.height / 2,
        gap,
        window.innerHeight - guideRect.height - gap,
      );
    }
    const defaultLeft = Number.parseFloat(window.getComputedStyle(guide).left) || 22;
    const defaultBottom = Number.parseFloat(window.getComputedStyle(guide).bottom) || 22;
    let frame = window.requestAnimationFrame(() => {
      if (!guide.classList.contains('is-moving')) {
        setPosition({
          left: defaultLeft,
          top: window.innerHeight - guideRect.height - defaultBottom,
        });
      }
      frame = window.requestAnimationFrame(() => setPosition({ left, top }));
    });

    return () => {
      window.clearTimeout(highlightTimer);
      window.cancelAnimationFrame(frame);
      target.classList.remove(HIGHLIGHT_CLASS);
    };
  }, [open, tourActive, tip]);

  const handleCharacterClick = () => {
    if (open) {
      setOpen(false);
      setTipIndex(0);
      setTourActive(false);
      setPosition(null);
      return;
    }
    setOpen(true);
    setTourActive(!tourCompleted);
  };

  const handleNextTip = () => {
    if (tourActive && tipIndex === tips.length - 1) {
      setTourActive(false);
      setTourCompleted(true);
      setPosition(null);
      setTipIndex(0);
      return;
    }
    setTipIndex((index) => (index + 1) % tips.length);
  };

  if (!tips) return null;

  return createPortal((
    <aside
      ref={guideRef}
      className={`clippy-guide${open ? ' is-open' : ''}${position ? ' is-moving' : ''}`}
      style={position ? { left: `${position.left}px`, top: `${position.top}px`, bottom: 'auto' } : undefined}
    >
      {open ? (
        <div className="clippy-bubble" role="status" aria-live="polite">
          <p>{tip.text}</p>
          {tips.length > 1 ? (
            <button
              type="button"
              className="clippy-next"
              onClick={handleNextTip}
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
        onClick={handleCharacterClick}
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
