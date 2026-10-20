/**
 * EngineeringWorkflow — Dashboard 5-step process rail
 * VISUAL_NAME=EngineeringWorkflow
 * CLASSIFICATION=ENGINEERING_SCHEMATIC
 * DATA_SOURCE=Static schematic — illustrative workflow, not a result
 */
import { ChevronRight } from 'lucide-react'

interface Step {
  icon: string
  titleKey: string
  subKey:   string
}

const STEPS: Step[] = [
  { icon: '⌨',  titleKey: 'dash.wf.input',   subKey: 'dash.wf.input_sub'  },
  { icon: '⚙',  titleKey: 'dash.wf.calc',    subKey: 'dash.wf.calc_sub'   },
  { icon: '✓',  titleKey: 'dash.wf.valid',   subKey: 'dash.wf.valid_sub'  },
  { icon: '📋', titleKey: 'dash.wf.trace',   subKey: 'dash.wf.trace_sub'  },
  { icon: '🤖', titleKey: 'dash.wf.ai',      subKey: 'dash.wf.ai_sub'     },
]

interface Props {
  t: (key: string) => string
}

export default function EngineeringWorkflow({ t }: Props) {
  return (
    <div className="mb-5">
      <div className="text-[10px] font-bold uppercase tracking-widest text-tp-text-3 mb-2">
        {t('dash.wf.title')}
      </div>
      <div className="overflow-x-auto">
        <div className="flex items-stretch gap-0 min-w-max">
          {STEPS.map((step, i) => (
            <div key={step.titleKey} className="flex items-center gap-0">
              <div className="flex flex-col items-center justify-center
                bg-tp-module border border-tp-border rounded-md
                px-4 py-3 min-w-[110px] text-center">
                <span className="text-[18px] mb-1 leading-none" aria-hidden="true">
                  {step.icon}
                </span>
                <div className="text-[11px] font-semibold text-tp-text leading-tight">
                  {t(step.titleKey)}
                </div>
                <div className="text-[9px] text-tp-text-3 mt-0.5 leading-tight">
                  {t(step.subKey)}
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <ChevronRight
                  size={14}
                  className="text-tp-text-3 mx-1 shrink-0 self-center"
                  aria-hidden="true"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
