interface Props {
  url: string;
}

export default function VideoPlayer(props: Props) {
  return (
    <div class="border-4 border-poke-gray bg-poke-darker p-2">
      <div class="text-[8px] text-poke-gold mb-2">IDLE ANIMATION</div>
      <video
        src={props.url}
        autoplay
        loop
        muted
        playsinline
        class="w-full"
        style={{ "image-rendering": "pixelated" }}
      />
    </div>
  );
}
