import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

export const PasswordInput: React.FC<PasswordInputProps> = ({ className = '', ...props }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="pw-wrap">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={`pw-field ${className}`.trim()}
      />
      <button
        type="button"
        className="pw-eye"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        title={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
};
