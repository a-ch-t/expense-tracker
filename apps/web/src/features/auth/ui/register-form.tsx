'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { ROUTES } from '@/shared/config/routes';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import { Input } from '@/shared/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form';
import { registerAction } from '../api/register.action';
import { registerFormSchema, type RegisterFormValues } from '../model/register.schema';

export function RegisterForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { name: '', email: '', password: '', acceptedTerms: false },
  });

  async function onSubmit(values: RegisterFormValues) {
    setFormError(null);

    // Успех уводит редиректом, поэтому результат приходит только при неудаче.
    const result = await registerAction(values);

    if (!result) {
      return;
    }

    // Занятый email — ошибка поля, а не запроса целиком.
    if (result.field) {
      form.setError(result.field, { message: result.error });
      return;
    }

    setFormError(result.error);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Имя</FormLabel>
              <FormControl>
                <Input autoComplete="name" placeholder="Анна" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Пароль</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="acceptedTerms"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-start gap-2">
                <FormControl>
                  <Checkbox
                    name={field.name}
                    ref={field.ref}
                    checked={field.value}
                    // onCheckedChange отдаёт ещё и 'indeterminate' — в форму пускаем только boolean.
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    onBlur={field.onBlur}
                    disabled={field.disabled}
                    className="mt-0.5"
                  />
                </FormControl>
                {/* Ссылки внутри label кликаются сами по себе: по спецификации label не
                    переключает чекбокс, когда клик пришёлся на интерактивный потомок. */}
                <FormLabel className="block text-sm leading-snug font-normal">
                  Согласен с{' '}
                  <Link href={ROUTES.terms} className="underline underline-offset-4">
                    пользовательским соглашением
                  </Link>{' '}
                  и{' '}
                  <Link href={ROUTES.privacy} className="underline underline-offset-4">
                    политикой обработки данных
                  </Link>
                </FormLabel>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
          Создать аккаунт
        </Button>
      </form>
    </Form>
  );
}
