export default function LoadingState({ message = 'Yükleniyor...' }: { message?: string }) {
  return <div className="flex items-center justify-center p-8 text-tp-text-2 text-sm">{message}</div>
}
