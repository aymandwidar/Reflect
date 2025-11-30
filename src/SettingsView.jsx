const SettingsView = ({ settings, onSave, loading }) => {
    const [formData, setFormData] = useState(settings || { age: '', groqKey: '', deepseekKey: '', geminiKey: '' });
    const [showKeys, setShowKeys] = useState({ groq: false, deepseek: false, gemini: false });

    useEffect(() => {
        if (settings) setFormData(settings);
    }, [settings]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const toggleShowKey = (key) => {
        setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="h-full overflow-y-auto p-6">
            <h2 className="text-2xl font-bold text-white mb-6">Settings</h2>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* User Info */}
                <div className="glass-card p-4 rounded-xl space-y-4">
                    <h3 className="font-medium text-white/90 flex items-center gap-2">
                        <Activity className="w-4 h-4" /> User Profile
                    </h3>
                    <div>
                        <label className="block text-xs text-white/60 mb-1">Age</label>
                        <input
                            type="number"
                            name="age"
                            value={formData.age}
                            onChange={handleChange}
                            placeholder="Enter your age"
                            className="w-full glass-input px-4 py-2 rounded-lg"
                        />
                    </div>
                </div>

                {/* API Keys */}
                <div className="glass-card p-4 rounded-xl space-y-4">
                    <h3 className="font-medium text-white/90 flex items-center gap-2">
                        <Lock className="w-4 h-4" /> API Keys (BYOK)
                    </h3>
                    <p className="text-xs text-white/50">
                        Your keys are stored securely in your private database.
                    </p>

                    {/* Groq */}
                    <div>
                        <label className="block text-xs text-white/60 mb-1">Groq API Key (Fast Response)</label>
                        <div className="relative">
                            <input
                                type={showKeys.groq ? "text" : "password"}
                                name="groqKey"
                                value={formData.groqKey}
                                onChange={handleChange}
                                placeholder="gsk_..."
                                className="w-full glass-input px-4 py-2 rounded-lg pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => toggleShowKey('groq')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                            >
                                {showKeys.groq ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                                {/* Using Mic icons as placeholder for Eye icons if not imported, but let's stick to text or just toggle */}
                                <span className="text-[10px]">{showKeys.groq ? 'Hide' : 'Show'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Deepseek */}
                    <div>
                        <label className="block text-xs text-white/60 mb-1">Deepseek API Key (Deep Think)</label>
                        <div className="relative">
                            <input
                                type={showKeys.deepseek ? "text" : "password"}
                                name="deepseekKey"
                                value={formData.deepseekKey}
                                onChange={handleChange}
                                placeholder="sk-..."
                                className="w-full glass-input px-4 py-2 rounded-lg pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => toggleShowKey('deepseek')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                            >
                                <span className="text-[10px]">{showKeys.deepseek ? 'Hide' : 'Show'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Gemini */}
                    <div>
                        <label className="block text-xs text-white/60 mb-1">Gemini API Key (Multimodal/Fallback)</label>
                        <div className="relative">
                            <input
                                type={showKeys.gemini ? "text" : "password"}
                                name="geminiKey"
                                value={formData.geminiKey}
                                onChange={handleChange}
                                placeholder="AIza..."
                                className="w-full glass-input px-4 py-2 rounded-lg pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => toggleShowKey('gemini')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                            >
                                <span className="text-[10px]">{showKeys.gemini ? 'Hide' : 'Show'}</span>
                            </button>
                        </div>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full glass-button py-3 rounded-xl font-bold text-lg flex items-center justify-center gap-2"
                >
                    {loading ? <Loader2 className="animate-spin" /> : <Send className="w-4 h-4" />}
                    Save Settings
                </button>
            </form>
        </div>
    );
};
