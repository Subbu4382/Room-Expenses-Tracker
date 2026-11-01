import { ReactNode } from 'react'
import { X } from 'lucide-react'

export function Btn({ variant = 'primary', className = '', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'blue' | 'ghost' | 'danger' }) {
  const v = { primary: 'bg-brand text-white hover:bg-orange-600', blue: 'bg-royal text-white hover:bg-blue-700',
    ghost: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50', danger: 'bg-red-600 text-white hover:bg-red-700' }[variant]
  return <button {...p} className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-50 ${v} ${className}`} />
}
export const Field = ({ label, children }: { label: string; children: ReactNode }) =>
  <label className="block text-sm"><span className="mb-1 block font-medium text-gray-600">{label}</span>{children}</label>

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 sm:max-w-lg sm:rounded-2xl" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} aria-label="Close"><X size={20} /></button></div>
        {children}
      </div>
    </div>)
}
export const Stat = ({ label, value, tone = 'text-gray-900', sub }: { label: string; value: string; tone?: string; sub?: string }) =>
  <div className="card"><p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
    <p className={`mt-1 text-xl font-bold ${tone}`}>{value}</p>{sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}</div>

export const PageHead = ({ title, children }: { title: string; children?: ReactNode }) =>
  <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h1 className="text-xl font-bold text-royal">{title}</h1><div className="flex flex-wrap gap-2">{children}</div></div>
export const Empty = ({ text }: { text: string }) => <p className="py-8 text-center text-sm text-gray-500">{text}</p>
export const ErrorMsg = ({ text }: { text: string }) => text ? <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{text}</p> : null
export const confirmDelete = (what: string) => window.confirm(`Delete ${what}? This cannot be undone.`)
