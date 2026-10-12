import React, { useState } from "react";
import { ArrowRight, Copy, Check, Users, Plus } from "lucide-react";
import "./RoomCard.css";

const EXAM_BADGES = {
  UPSC: "badge-upsc",
  GATE: "badge-gate",
  NEET: "badge-neet",
  JEE: "badge-jee",
  CAT: "badge-cat",
  SSC: "badge-ssc",
  General: "badge-general",
};

export default function RoomCard({ room, onEnter, disabled = false, index = 0 }) {
  const [copied, setCopied] = useState(false);
  const badgeClass = EXAM_BADGES[room.examCategory] || "badge-general";
  const serial = String((index ?? 0) + 1).padStart(2, "0");
  const maxCap = room.maxMembers || 6;
  const currentCount = room.memberCount || Math.min(Math.max((room.id ? (room.id.charCodeAt(0) % 5) + 1 : 2), 1), maxCap);

  const handleCopyCode = (e) => {
    e.stopPropagation();
    if (!room.roomCode) return;
    navigator.clipboard?.writeText(room.roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <article
      role="button"
      tabIndex={disabled ? -1 : 0}
      className={`chamber-dossier ${disabled ? "is-disabled" : ""}`}
      aria-label={`Join room ${room.name}`}
      onClick={() => !disabled && onEnter?.(room)}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onEnter?.(room);
        }
      }}
    >
      {/* Left Accent Ribbon / Track Identifier */}
      <div className="chamber-dossier-ribbon">
        <span className="chamber-serial">#{serial}</span>
        <span className={`badge ${badgeClass}`}>{room.examCategory || "General"}</span>
      </div>

      {/* Main Chamber Info */}
      <div className="chamber-dossier-main">
        <div className="chamber-title-row">
          <h3 className="chamber-title">{room.name}</h3>
          <div className="chamber-live-pulse" title="Active synchronized session">
            <span className="chamber-pulse-dot"></span>
            <span className="chamber-pulse-label">LIVE</span>
          </div>
        </div>

        <p className="chamber-desc">
          {room.description || "Focused study room with Pomodoro timer and group accountability."}
        </p>

        {/* Telemetry Row: Occupancy and Room Code */}
        <div className="chamber-telemetry">
          <div className="chamber-occupancy">
            <div className="chamber-occupancy-label">
              <Users size={13} className="chamber-icon" />
              <span>{currentCount} / {maxCap} Members</span>
            </div>
            <div className="chamber-occupancy-segments" aria-label={`Capacity: ${currentCount} of ${maxCap}`}>
              {Array.from({ length: maxCap }).map((_, i) => (
                <span
                  key={i}
                  className={`occupancy-segment ${i < currentCount ? "filled" : ""}`}
                />
              ))}
            </div>
          </div>

          {room.roomCode && (
            <button
              type="button"
              className={`chamber-code-chip ${copied ? "copied" : ""}`}
              onClick={handleCopyCode}
              title="Click to copy room code"
            >
              <span className="chamber-code-label">CODE:</span>
              <span className="chamber-code-val">{room.roomCode}</span>
              {copied ? <Check size={12} className="chamber-copy-icon" /> : <Copy size={12} className="chamber-copy-icon" />}
            </button>
          )}
        </div>
      </div>

      {/* Right Action Trigger */}
      <div className="chamber-dossier-action">
        <button
          type="button"
          className="chamber-enter-btn"
          data-clippy-target="dashboard-join-room"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) onEnter?.(room);
          }}
        >
          <span>{disabled ? "Joining..." : "Join Room"}</span>
          <ArrowRight size={15} className="chamber-arrow" />
        </button>
      </div>
    </article>
  );
}

export function CreateRoomCard({ onCreate }) {
  return (
    <button className="chamber-dossier chamber-dossier-create" onClick={onCreate}>
      <div className="chamber-create-icon-ring">
        <Plus size={22} />
      </div>
      <div className="chamber-create-info">
        <h3 className="chamber-create-title">Create a New Study Room</h3>
        <p className="chamber-create-sub">
          Set up a custom study room with timer and goals for your group.
        </p>
      </div>
      <div className="chamber-create-action">
        <span className="chamber-create-badge">Create Room &rarr;</span>
      </div>
    </button>
  );
}
