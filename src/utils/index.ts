export function randomInRange(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

const sounds = [
  'tada.mp3',
  'ding.wav',
  'pop.wav',
  'woohoo.mp3',
  'yay.mp3',
];

export function playRandomSound() {
  const soundIndex = Math.floor(Math.random() * sounds.length);
  const sound = new Audio(`/sounds/${sounds[soundIndex]}`);
  sound.volume = 0.5;
  sound.play().catch(error => {
    console.error('Error playing sound:', error);
  });
}
