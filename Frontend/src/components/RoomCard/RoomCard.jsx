import "./RoomCard.css";

// examTag drives the small corner label + accent color per exam type.
// Keep this list in sync with whatever exam categories the backend sends.
const EXAM_STYLES = {
  UPSC: { label: "UPSC", tint: "tint-a" },
  GATE: { label: "GATE", tint: "tint-b" },
  NEET: { label: "NEET", tint: "tint-c" },
  JEE: { label: "JEE", tint: "tint-d" },
  CAT: { label: "CAT", tint: "tint-e" },
  SSC: { label: "SSC", tint: "tint-f" },
};

export default function RoomCard({ room, onEnter, disabled = false }) {
  const exam = EXAM_STYLES[room.examCategory] || {
    label: room.examCategory,
    tint: "tint-a",
  };

  return (
    <button
      className={`room-card ${exam.tint}`}
      aria-label={`Join room ${room.name}`}
      disabled={disabled}
      onClick={() => onEnter?.(room)}
    >
      <div className="room-card-top">
        <span className="room-card-tag">{exam.label}</span>
        <span className="room-card-code">Code: {room.roomCode}</span>
      </div>

      <h3 className="room-card-title">{room.name}</h3>

      {room.description && (
        <p className="room-card-description">{room.description}</p>
      )}
    </button>
  );
}

export function CreateRoomCard({ onCreate }) {
  return (
    <button className="room-card room-card-create" onClick={onCreate}>
      <span className="room-card-create-plus">+</span>
      <span className="room-card-create-label">Create room</span>
    </button>
  );
}