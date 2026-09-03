import React from 'react';
import './common.css';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'icon-only';
  icon?: React.ReactNode;
  label?: React.ReactNode;
  active?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function Button({
  variant = 'secondary',
  icon,
  label,
  active = false,
  size = 'md',
  className = '',
  children,
  type = 'button',
  disabled,
  ...props
}: ButtonProps) {
  const variantClass = `common-btn-${variant}`;
  const activeClass = active ? 'active' : '';
  const sizeClass = size !== 'md' ? `size-${size}` : '';

  return (
    <button
      type={type}
      disabled={disabled}
      className={`common-btn ${variantClass} ${activeClass} ${sizeClass} ${className}`.trim()}
      {...props}
    >
      {icon && <span className="common-btn-icon" aria-hidden="true">{icon}</span>}
      {label && <span className="common-btn-label">{label}</span>}
      {children}
    </button>
  );
}

export { Button };
