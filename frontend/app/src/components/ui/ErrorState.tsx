export default function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="p-6 text-center">
      <p className="text-tp-error text-sm mb-2">{message}</p>
      {onRetry && <button onClick={onRetry} className="text-xs text-tp-accent hover:text-tp-accent-light">Tekrar dene</button>}
    </div>
  )
}
