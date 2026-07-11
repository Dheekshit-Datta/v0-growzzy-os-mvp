"use client"

export function AILoader({
    fullscreen = false,
    text = "Processing..."
}: {
    fullscreen?: boolean
    text?: string
}) {
    const containerClasses = fullscreen
        ? "fixed inset-0 z-50 bg-gradient-to-b from-[#edf3ff] via-[#e8f0ff] to-[#f6f9ff] flex flex-col items-center justify-center p-4"
        : "w-full h-full min-h-[400px] bg-gradient-to-b from-[#edf3ff] via-[#e8f0ff] to-[#f6f9ff] rounded-xl flex flex-col items-center justify-center overflow-hidden relative p-8 border border-[#dbe7ff]"

    return (
        <div className={containerClasses}>
            {/* Central Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-blue-500/20 blur-[100px] rounded-full animate-pulse" />

            {/* 3D Sphere Animation */}
            <div className="relative w-32 h-32 md:w-48 md:h-48 perspective-1000">
                <div className="absolute inset-0 border-[3px] border-cyan-400/80 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.5)] animate-[spin_3s_linear_infinite]"
                    style={{ transformStyle: "preserve-3d", transform: "rotateX(70deg) rotateY(10deg)" }}></div>

                <div className="absolute inset-0 border-[3px] border-blue-500/80 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)] animate-[spin_4s_linear_infinite_reverse]"
                    style={{ transformStyle: "preserve-3d", transform: "rotateX(70deg) rotateY(60deg)" }}></div>

                <div className="absolute inset-0 border-[3px] border-indigo-500/80 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)] animate-[spin_5s_linear_infinite]"
                    style={{ transformStyle: "preserve-3d", transform: "rotateX(70deg) rotateY(-60deg)" }}></div>

                {/* Inner Core */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-full blur-md animate-pulse shadow-[0_0_30px_rgba(59,130,246,0.8)]" />
            </div>

            {/* Loading Text */}
            <div className="mt-12 text-center z-10 space-y-2">
                <h3 className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#1f57f5] via-[#2baff2] to-[#1f57f5] tracking-tight">
                    AI IS THINKING
                </h3>
                <p className="text-slate-600 text-sm md:text-base animate-pulse">
                    {text}
                </p>
            </div>
        </div>
    )
}
