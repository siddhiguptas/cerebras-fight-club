import type { AiStatus } from './rivalPanelTypes'

export type { AiStatus }

let complaintHandler: ((text: string) => void) | null = null
let matchActive = false

const rootId = 'rival-patch-panel'

export function onComplaint(handler: (text: string) => void): void {
  complaintHandler = handler
}

export function setAiStatus(status: AiStatus, detail = ''): void {
  const chip = document.querySelector<HTMLElement>(`#${rootId} [data-ai-status]`)
  if (!chip) return
  const labels: Record<AiStatus, string> = {
    offline: 'AI offline',
    live: 'Kimi live',
    busy: 'Patching…',
    error: 'AI error',
  }
  chip.dataset.state = status
  chip.textContent = detail || labels[status]
}

export function setMatchActive(active: boolean): void {
  matchActive = active
  const panel = document.getElementById(rootId)
  if (panel) panel.dataset.match = active ? 'on' : 'off'
}

export function mountRivalPanel(): void {
  if (document.getElementById(rootId)) return

  const host = document.getElementById('rival-patch-host') ?? document.body

  const panel = document.createElement('aside')
  panel.id = rootId
  panel.innerHTML = `
    <div class="rp-status" data-ai-status data-state="offline">Checking…</div>
    <form class="rp-complaint" data-match="off">
      <label class="sr-only" for="rp-complaint-input">Complaint to AI developer</label>
      <div class="rp-complaint-row">
        <input id="rp-complaint-input" maxlength="280" placeholder="Too hard? Tell the dev…" autocomplete="off" />
        <button type="submit">SEND</button>
      </div>
    </form>
  `

  const form = panel.querySelector<HTMLFormElement>('.rp-complaint')
  const input = panel.querySelector<HTMLInputElement>('#rp-complaint-input')

  form?.addEventListener('submit', (event) => {
    event.preventDefault()
    if (!matchActive || !complaintHandler || !input) return
    const text = input.value.trim()
    if (!text) return
    complaintHandler(text)
    input.value = ''
  })

  host.appendChild(panel)
}