import type { ComponentProps } from 'react'
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

interface TextFieldProps<T extends FieldValues> {
  form: UseFormReturn<T>
  name: Path<T>
  label: string
  description?: string
  type?: ComponentProps<typeof Input>['type']
  inputMode?: ComponentProps<typeof Input>['inputMode']
  autoComplete?: string
  placeholder?: string
  autoFocus?: boolean
  /** Reformata o valor a cada tecla (ex.: máscara de telefone, `formatPhoneInput`). */
  mask?: (value: string) => string
}

/** Campo de texto ligado ao React Hook Form, com label, descrição e erro de validação. */
export function TextField<T extends FieldValues>({
  form,
  name,
  label,
  description,
  mask,
  ...inputProps
}: TextFieldProps<T>) {
  const { error } = form.getFieldState(name, form.formState)
  const field = form.register(name)

  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input
        id={name}
        aria-invalid={!!error}
        {...inputProps}
        {...field}
        onChange={(event) => {
          if (mask) event.target.value = mask(event.target.value)
          return field.onChange(event)
        }}
      />
      {description && <FieldDescription>{description}</FieldDescription>}
      <FieldError errors={[error]} />
    </Field>
  )
}
