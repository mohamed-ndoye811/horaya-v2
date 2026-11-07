import { NOTIFICATION_TYPES, type NotificationPreference } from "@horaya/core";
import { FormAlert } from "@/components/ui/form-alert";
import { cardClasses } from "@/components/ui/section";
import { Switch } from "@/components/ui/switch";
import { saveNotificationsAction } from "@/functions/settings";
import { cn } from "@/lib/cn";
import { useSuccessToast } from "@/lib/toast";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";

/** Préférences de notification du membre : par e-mail et dans l'app (cloche du notch). */
export function NotificationsForm({ preferences }: { preferences: NotificationPreference[] }) {
  const { state, onSubmit } = useFormAction<FormState>(saveNotificationsAction, {});
  useSuccessToast(state);
  return (
    <form id="notifications-form" onSubmit={onSubmit} className="flex flex-col gap-4">
      {state.error && <FormAlert>{state.error}</FormAlert>}
      <section aria-labelledby="notifications-title" className={cn(cardClasses, "min-w-0 sm:p-6")}>
        <div className="flex items-center gap-2.5 pb-3">
          <h2
            id="notifications-title"
            className="grow text-lg font-semibold leading-[22px] text-ink"
          >
            Notifications
          </h2>
          <span className="w-14 shrink-0 text-center text-xs font-semibold text-ink-subtle">
            E-mail
          </span>
          <span className="w-14 shrink-0 text-center text-xs font-semibold text-ink-subtle">
            Dans l'app
          </span>
        </div>
        <ul>
          {NOTIFICATION_TYPES.map((type) => {
            const current = preferences.find((entry) => entry.type === type.value);
            return (
              <li
                key={type.value}
                className="flex items-center gap-3 border-t border-line-faint py-3"
              >
                <span className="min-w-0 grow text-sm leading-[18px] text-ink">{type.label}</span>
                <span className="flex w-14 shrink-0 justify-center">
                  <Switch
                    hideLabel
                    label={`${type.label} par e-mail`}
                    name={`email:${type.value}`}
                    defaultChecked={current?.email ?? type.email}
                  />
                </span>
                <span className="flex w-14 shrink-0 justify-center">
                  <Switch
                    hideLabel
                    label={`${type.label} dans l'app`}
                    name={`inApp:${type.value}`}
                    defaultChecked={current?.inApp ?? type.inApp}
                  />
                </span>
              </li>
            );
          })}
        </ul>
        <p className="pt-2 text-xs leading-4 text-ink-subtle">
          Tes préférences personnelles : chaque membre règle les siennes.
        </p>
      </section>
    </form>
  );
}
