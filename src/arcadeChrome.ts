const TIPS = [
  'MOVE A/D · JUMP W · CROUCH S · BLOCK Q',
  'FIGHT E light · R heavy · T kick',
  'SPECIAL Q+E · SUPER Q+T · THROW Q+R close',
  'DASH double-tap A or D · ENTER / click to advance',
  'Pick fighter A/D · AI rival updates every ~9s',
]

export function mountControlTicker(): void {
  const ticker = document.getElementById('control-ticker')
  if (!ticker) return

  let index = 0
  const render = (): void => {
    ticker.textContent = TIPS[index % TIPS.length]
    index += 1
  }
  render()
  window.setInterval(render, 4200)
}