import React from 'react';

type Props = {
	label?: string;
	value: string | number | undefined | null;
	onChange: (val: string) => void;
	placeholder?: string;
	className?: string;
	type?: 'text' | 'number';
};

export function EditableInput({ label, value, onChange, placeholder, className, type = 'text' }: Props) {
	return (
		<div className={className}>
			{label ? <div className="label">{label}</div> : null}
			<input
				className="input"
				type={type}
				value={value ?? ''}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
			/>
		</div>
	);
}

export function EditableTextArea({ label, value, onChange, placeholder, className }: Props) {
	return (
		<div className={className}>
			{label ? <div className="label">{label}</div> : null}
			<textarea
				rows={3}
				className="input"
				value={(value as string) ?? ''}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
			/>
		</div>
	);
}
