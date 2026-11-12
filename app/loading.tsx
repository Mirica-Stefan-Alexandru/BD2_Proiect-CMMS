// Schelet afisat instant la navigare, pana cand serverul trimite pagina.
export default function Loading() {
    return (
        <div className="min-h-screen bg-[#222831]">
            <div className="h-[106px] border-b border-[#393E46] bg-[#222831]/90" />
            <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6" aria-busy="true" aria-label="Se incarca">
                <div className="space-y-2">
                    <div className="skeleton h-3 w-32 rounded" />
                    <div className="skeleton h-8 w-72 rounded-lg" />
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="skeleton h-24 rounded-2xl" />
                    ))}
                </div>
                <div className="skeleton h-16 rounded-2xl" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="skeleton h-64 rounded-2xl" />
                    ))}
                </div>
            </div>
        </div>
    );
}
