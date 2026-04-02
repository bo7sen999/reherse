import { useRef, useEffect } from "react";

interface AudioWaveProps {
  isRecording: boolean;
  analyser?: AnalyserNode | null;
  className?: string;
}

export function AudioWave({ isRecording, analyser, className }: AudioWaveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    let time = 0;

    function draw() {
      const W = canvas!.width;
      const H = canvas!.height;
      ctx.clearRect(0, 0, W, H);

      const gradient = ctx.createLinearGradient(0, 0, W, 0);
      gradient.addColorStop(0, "rgba(155,142,196,0.0)");
      gradient.addColorStop(0.2, "rgba(155,142,196,0.6)");
      gradient.addColorStop(0.8, "rgba(155,142,196,0.6)");
      gradient.addColorStop(1, "rgba(155,142,196,0.0)");

      if (analyser && isRecording) {
        // Real audio data
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteTimeDomainData(dataArray);

        ctx.beginPath();
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        const sliceWidth = W / dataArray.length;
        let x = 0;

        for (let i = 0; i < dataArray.length; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * H) / 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.lineTo(W, H / 2);
        ctx.stroke();
      } else {
        // Animated idle wave
        ctx.beginPath();
        ctx.strokeStyle = isRecording ? gradient : "rgba(155,142,196,0.2)";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";

        const frequency = isRecording ? 0.03 : 0.015;
        const amplitude = isRecording ? 30 : 8;

        for (let x = 0; x <= W; x += 2) {
          const y =
            H / 2 +
            Math.sin(x * frequency + time) * amplitude +
            Math.sin(x * frequency * 2 + time * 1.3) * (amplitude * 0.3);

          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        time += isRecording ? 0.08 : 0.03;
      }

      animRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [isRecording, analyser]);

  return (
    <canvas
      ref={canvasRef}
      className={`wave-canvas ${className ?? ""}`}
      width={700}
      height={120}
    />
  );
}
