import { IconForkNodes } from '../../../../shared/chat-ui/ChatIcons';

type ForkReplyButtonProps = {
  messageId: string;
  onFork?: (messageId: string) => boolean | Promise<boolean>;
};

export function ForkReplyButton({ messageId, onFork }: ForkReplyButtonProps) {
  return (
    <button
      aria-label="Fork reply"
      className="message-fork-btn fork-variant-soft"
      data-message-id={messageId}
      onClick={() => void onFork?.(messageId)}
      title="Fork from this reply"
      type="button"
    >
      <IconForkNodes />
    </button>
  );
}
