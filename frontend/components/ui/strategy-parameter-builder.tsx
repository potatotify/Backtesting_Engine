"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./card";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import { Select } from "./select";
import { Sliders, ChevronRight, Search } from "lucide-react";
import {
    STRATEGY_DEFINITIONS,
    getStrategiesByCategory,
    CATEGORY_LABELS,
    type StrategyDefinition,
    type StrategyCategory,
} from "@/lib/strategyDefinitions";

export interface GeneratedStrategy {
    id: string;
    name: string;
    description: string;
    className: string;
    code: string;
    features: string[];
}

interface StrategyParameterBuilderProps {
    onGenerate: (strategy: GeneratedStrategy) => void;
}

function getDefaultParams(def: StrategyDefinition): Record<string, unknown> {
    const params: Record<string, unknown> = {};
    def.parameters.forEach((p) => {
        params[p.id] = p.default;
    });
    return params;
}

export default function StrategyParameterBuilder({ onGenerate }: StrategyParameterBuilderProps) {
    const [selectedDef, setSelectedDef] = useState<StrategyDefinition | null>(null);
    const [strategyName, setStrategyName] = useState("");
    const [params, setParams] = useState<Record<string, unknown>>({});
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<StrategyCategory | "all">("all");

    const groupedStrategies = useMemo(() => getStrategiesByCategory(), []);

    const filteredStrategies = useMemo(() => {
        let list = STRATEGY_DEFINITIONS;
        if (selectedCategory !== "all") {
            list = groupedStrategies[selectedCategory] || [];
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(
                (s) =>
                    s.name.toLowerCase().includes(q) ||
                    s.description.toLowerCase().includes(q) ||
                    s.category.toLowerCase().includes(q)
            );
        }
        return list;
    }, [searchQuery, selectedCategory, groupedStrategies]);

    const handleSelectStrategy = (def: StrategyDefinition) => {
        setSelectedDef(def);
        setStrategyName(def.name);
        setParams(getDefaultParams(def));
    };

    const handleParamChange = (paramId: string, value: unknown) => {
        setParams((prev) => ({ ...prev, [paramId]: value }));
    };

    const handleGenerate = () => {
        if (!selectedDef) return;
        const name = strategyName.trim() || selectedDef.name;
        const code = selectedDef.generateCode(params, name);
        onGenerate({
            id: selectedDef.id,
            name,
            description: selectedDef.description,
            className: selectedDef.className,
            code,
            features: ["Parameter-based", "Editable before save", CATEGORY_LABELS[selectedDef.category]],
        });
    };

    return (
        <div className="space-y-6">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-[var(--color-primary-text)] mb-2 flex items-center justify-center gap-2">
                    <Sliders className="h-7 w-7 text-[var(--color-primary)]" />
                    Quick Build — Any Strategy
                </h2>
                <p className="text-[var(--color-muted)]">
                    Choose from 10+ strategy types, set parameters, and we&apos;ll generate the Python code
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Strategy Selector */}
                <Card className="lg:col-span-1 card-hover">
                    <CardHeader>
                        <CardTitle>Step 1: Choose Strategy</CardTitle>
                        <CardDescription>Select the strategy type you want to build</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-muted)]" />
                            <Input
                                placeholder="Search strategies..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value as StrategyCategory | "all")}
                        >
                            <option value="all">All Categories</option>
                            {(Object.keys(CATEGORY_LABELS) as StrategyCategory[]).map((cat) => (
                                <option key={cat} value={cat}>
                                    {CATEGORY_LABELS[cat]}
                                </option>
                            ))}
                        </Select>
                        <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1">
                            {filteredStrategies.map((def) => (
                                <button
                                    key={def.id}
                                    onClick={() => handleSelectStrategy(def)}
                                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                                        selectedDef?.id === def.id
                                            ? "border-[var(--color-primary)] bg-blue-50"
                                            : "border-[var(--color-border)] hover:border-gray-300 hover:bg-gray-50"
                                    }`}
                                >
                                    <h4 className="font-medium text-[var(--color-primary-text)]">{def.name}</h4>
                                    <p className="text-xs text-[var(--color-muted)] mt-1 line-clamp-2">{def.description}</p>
                                    <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                                        {CATEGORY_LABELS[def.category]}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Parameters */}
                <Card className="lg:col-span-2 card-hover">
                    <CardHeader>
                        <CardTitle>Step 2: Set Parameters</CardTitle>
                        <CardDescription>
                            {selectedDef
                                ? `Configure ${selectedDef.name}`
                                : "Select a strategy to configure its parameters"}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {!selectedDef ? (
                            <div className="py-12 text-center text-[var(--color-muted)]">
                                <Sliders className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                <p>Select a strategy from the list to set parameters</p>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <Label htmlFor="strategyName">Strategy Name</Label>
                                    <Input
                                        id="strategyName"
                                        placeholder={selectedDef.name}
                                        value={strategyName}
                                        onChange={(e) => setStrategyName(e.target.value)}
                                        className="mt-1"
                                    />
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {selectedDef.parameters.map((param) => (
                                        <div key={param.id} className="space-y-1">
                                            <Label htmlFor={param.id}>{param.label}</Label>
                                            {param.type === "number" && (
                                                <Input
                                                    id={param.id}
                                                    type="number"
                                                    min={param.min}
                                                    max={param.max}
                                                    step={param.step ?? 1}
                                                    value={(params[param.id] as number) ?? param.default}
                                                    onChange={(e) =>
                                                        handleParamChange(
                                                            param.id,
                                                            param.step && param.step < 1
                                                                ? parseFloat(e.target.value) || param.default
                                                                : parseInt(e.target.value) || param.default
                                                        )
                                                    }
                                                />
                                            )}
                                            {param.type === "select" && (
                                                <Select
                                                    id={param.id}
                                                    value={(params[param.id] as string) ?? param.default}
                                                    onChange={(e) => handleParamChange(param.id, e.target.value)}
                                                >
                                                    {param.options?.map((opt) => (
                                                        <option key={opt.value} value={opt.value}>
                                                            {opt.label}
                                                        </option>
                                                    ))}
                                                </Select>
                                            )}
                                            {param.type === "boolean" && (
                                                <Select
                                                    id={param.id}
                                                    value={params[param.id] ? "true" : "false"}
                                                    onChange={(e) => handleParamChange(param.id, e.target.value === "true")}
                                                >
                                                    <option value="false">No</option>
                                                    <option value="true">Yes</option>
                                                </Select>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <Button
                                    onClick={handleGenerate}
                                    className="w-full btn-gradient py-6"
                                >
                                    <Sliders className="h-5 w-5 mr-2" />
                                    Generate Strategy Code
                                    <ChevronRight className="h-5 w-5 ml-2" />
                                </Button>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
