export default function EmptyState({ message = 'Veri bulunamadı' }: { message?: string }) {
  return <div className="p-8 text-center text-tp-text-3 text-sm">{message}</div>
}
