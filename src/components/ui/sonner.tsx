import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      position="bottom-center"
      expand
      gap={10}
      visibleToasts={3}
      closeButton
      offset="1rem"
      mobileOffset={{
        bottom: "calc(5.25rem + env(safe-area-inset-bottom, 0px))",
      }}
      className="toaster group"
      style={{ "--width": "min(100vw - 2rem, 26rem)" } as React.CSSProperties}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "nerdubbio-toast group toast relative flex w-full items-start gap-3 rounded-2xl border border-border/70 bg-surface/95 p-3.5 pr-9 pl-3 shadow-glow backdrop-blur-xl",
          title: "text-sm font-semibold leading-snug text-foreground",
          description: "mt-0.5 text-xs leading-relaxed text-muted-foreground",
          content: "flex-1 min-w-0",
          icon: "shrink-0",
          actionButton:
            "ml-auto shrink-0 rounded-xl bg-accent/15 px-3 py-1.5 text-xs font-bold text-accent transition hover:bg-accent/25",
          cancelButton:
            "shrink-0 rounded-xl bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted",
          closeButton:
            "absolute right-2 top-2 rounded-lg border border-border/50 bg-surface-2/80 p-1 text-muted-foreground transition hover:text-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
