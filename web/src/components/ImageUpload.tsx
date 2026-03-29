import { createSignal, Show } from "solid-js";

interface Props {
  onFileSelect: (file: File | null) => void;
  disabled?: boolean;
}

export default function ImageUpload(props: Props) {
  const [preview, setPreview] = createSignal<string | null>(null);
  const [isDragOver, setIsDragOver] = createSignal(false);

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    props.onFileSelect(file);
    const url = URL.createObjectURL(file);
    setPreview(url);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer?.files[0];
    if (file) handleFile(file);
  }

  function handleInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) handleFile(file);
  }

  function clear() {
    const prev = preview();
    if (prev) URL.revokeObjectURL(prev);
    setPreview(null);
    props.onFileSelect(null);
  }

  return (
    <div class="relative">
      <Show
        when={!preview()}
        fallback={
          <div class="relative border-4 border-poke-gray bg-poke-dark p-2">
            <img
              src={preview()!}
              alt="Upload preview"
              class="w-full h-48 object-contain"
              data-pixel
            />
            <button
              class="absolute top-1 right-1 bg-poke-red text-white px-2 py-1 text-[8px] border-2 border-poke-dark"
              onClick={clear}
              disabled={props.disabled}
            >
              X
            </button>
          </div>
        }
      >
        <label
          class={`flex flex-col items-center justify-center h-36 border-4 border-dashed cursor-pointer transition-colors ${
            isDragOver()
              ? "border-poke-gold bg-poke-gold/10"
              : "border-poke-gray bg-poke-dark hover:border-poke-gold/50"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          <span class="text-xs text-poke-light/60 mb-2">
            DROP IMAGE HERE
          </span>
          <span class="text-[8px] text-poke-light/40">or click to browse</span>
          <input
            type="file"
            accept="image/*"
            class="hidden"
            onChange={handleInput}
            disabled={props.disabled}
          />
        </label>
      </Show>
    </div>
  );
}
