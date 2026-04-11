import { BlockMath } from "react-katex"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import { HugeiconsIcon } from "@hugeicons/react"
import { InformationCircleIcon } from "@hugeicons/core-free-icons"

export type StatFormulaDialogProps = {
  title: string
  /** LaTeX (display), ecuación general */
  generalLatex?: string
  /** LaTeX (display), con valores sustituidos */
  substitutedLatex?: string
  explanation?: string,
}

export function StatFormulaDialog({
  title,
  generalLatex,
  substitutedLatex,
  explanation
}: StatFormulaDialogProps) {
  return (
    <Dialog>
      <DialogTrigger
        nativeButton={false}
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            type="button"
            aria-label={`Fórmula utilizada: ${title}`}
            className="text-muted-foreground hover:text-foreground"
          />
        }
      >
        <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
      </DialogTrigger>
      <DialogContent className="w-[min(64rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            Definición matemática y sustitución con los datos ingresados.
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[calc(100vh-10rem)] flex-col gap-5 overflow-hidden">
          {explanation ? (<section className="flex flex-col gap-2">
            <p className="text-muted-foreground text-xs font-medium tracking-wide ">
              {explanation}
            </p>

          </section>) : null}


          <section className="flex flex-col gap-2">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Fórmula
            </p>
            <div className="bg-muted/40 max-h-[28vh] max-w-full overflow-auto rounded-lg px-3 py-3 text-xs sm:text-sm [&_.katex-display]:my-0">
              <div className="mx-auto w-fit min-w-max">
                {generalLatex ? <BlockMath math={generalLatex} /> : null}
              </div>
            </div>
          </section>
          <section className="flex flex-col gap-2">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Con tus datos
            </p>
            <div className="bg-muted/40 max-h-[36vh] max-w-full overflow-auto rounded-lg px-3 py-3 text-xs sm:text-sm [&_.katex-display]:my-0">
              <div className="mx-auto w-fit min-w-max">
                {substitutedLatex ? <BlockMath math={substitutedLatex} /> : null}
              </div>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
