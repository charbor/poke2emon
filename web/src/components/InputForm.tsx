import { createSignal } from "solid-js";
import ImageUpload from "./ImageUpload";

interface Props {
  onSubmit: (prompt: string, imageFile: File | null) => void;
  disabled?: boolean;
}

export default function InputForm(props: Props) {
  const [prompt, setPrompt] = createSignal("");
  const [imageFile, setImageFile] = createSignal<File | null>(null);

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (!prompt() && !imageFile()) return;
    props.onSubmit(prompt(), imageFile());
  }

  const canSubmit = () => (prompt().trim() || imageFile()) && !props.disabled;

  return (
    <form onSubmit={handleSubmit} class="flex flex-col gap-4">
      <div class="border-4 border-poke-gray bg-poke-dark p-4">
        <label class="block text-[10px] text-poke-gold mb-2">
          DESCRIBE YOUR POKEMON
        </label>
        <textarea
          value={prompt()}
          onInput={(e) => setPrompt(e.currentTarget.value)}
          placeholder="A fire-breathing cactus that lives in volcanoes..."
          class="w-full bg-poke-darker border-2 border-poke-gray text-poke-light text-xs p-3 resize-none h-24 focus:border-poke-gold focus:outline-none placeholder:text-poke-light/30"
          disabled={props.disabled}
        />
      </div>

      <div class="border-4 border-poke-gray bg-poke-dark p-4">
        <label class="block text-[10px] text-poke-gold mb-2">
          OR UPLOAD A PHOTO
        </label>
        <ImageUpload onFileSelect={setImageFile} disabled={props.disabled} />
      </div>

      <button
        type="submit"
        class="pixel-btn bg-poke-red text-white px-6 py-4 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={!canSubmit()}
      >
        {props.disabled ? "GENERATING..." : "GENERATE POKEMON"}
      </button>
    </form>
  );
}
