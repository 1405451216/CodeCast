import { ToolCallItem, type ToolCall } from './ToolCallItem';
export function ToolCallList({ calls }: { calls: ToolCall[] }) {
  return <div>{calls.map(c => <ToolCallItem key={c.id} call={c} />)}</div>;
}
