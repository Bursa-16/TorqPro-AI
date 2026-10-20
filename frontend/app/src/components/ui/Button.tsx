import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children: ReactNode
}

const variantClass: Record<Variant, string> = {
  primary:   'tp-btn-primary',
  secondary: 'tp-btn-secondary',
  danger:    'tp-btn-danger',
  ghost:     'tp-btn-ghost',
}

const sizeClass: Record<Size, string> = {
  sm: 'tp-btn-sm',
  md: 'tp-btn-md',
  lg: 'tp-btn-lg',
}

export default function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={`tp-btn ${variantClass[variant]} ${sizeClass[size]}${className ? ` ${className}` : ''}`}
    >
      {children}
    </button>
  )
}
