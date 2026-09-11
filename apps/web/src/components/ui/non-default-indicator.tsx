export default function NonDefaultIndicator({ isNotDefaultState }: { isNotDefaultState: boolean }) {
  return (
    <div
      data-non-default={isNotDefaultState || undefined}
      className="bg-warning absolute top-1 right-1 h-1.5 w-1.5 scale-50 rounded-full opacity-0 transition-[scale,opacity] data-non-default:scale-100 data-non-default:opacity-100"
    />
  );
}
