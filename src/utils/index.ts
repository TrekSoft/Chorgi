export function randomInRange(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

const sounds = [
  'confetti1.wav',
  'confetti2.wav',
  'confetti3.wav',
  'confetti4.wav',
  'confetti5.wav',
];

export function playRandomSound() {
  const soundIndex = Math.floor(Math.random() * sounds.length);
  const sound = new Audio(`/sounds/${sounds[soundIndex]}`);
  sound.volume = 0.5;
  sound.play().catch(error => {
    console.error('Error playing sound:', error);
  });
}
