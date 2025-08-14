import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Select } from './ui/select';
import { BarChart3, RefreshCw } from './icons/Icons';

interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  volume: number;
  high24h: number;
  low24h: number;
  lastUpdate: string;
}

interface MarketSelectorProps {
  markets: MarketData[];
  selectedSymbol: string;
  onSymbolChange: (symbol: string) => void;
  isConnected: boolean;
  connectionStatus: string;
  connectionColor: string;
  autoRefresh: boolean;
  onAutoRefreshToggle: () => void;
}

export const MarketSelector: React.FC<MarketSelectorProps> = ({
  markets,
  selectedSymbol,
  onSymbolChange,
  isConnected,
  connectionStatus,
  connectionColor,
  autoRefresh,
  onAutoRefreshToggle
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filtrar mercados baseado na busca
  const filteredMarkets = markets.filter(market =>
    market.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Mercado selecionado
  const selectedMarket = markets.find(m => m.symbol === selectedSymbol);

  // Top gainers e losers para exibição rápida
  const topGainers = markets
    .filter(m => m.change24h > 0)
    .sort((a, b) => b.change24h - a.change24h)
    .slice(0, 3);

  const topLosers = markets
    .filter(m => m.change24h < 0)
    .sort((a, b) => a.change24h - b.change24h)
    .slice(0, 3);

  return (
    <Card className="bg-white/10 backdrop-blur-sm border-white/20">
      <CardHeader>
        <CardTitle className="text-white text-lg flex items-center justify-between">
          <span className="flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            Seletor de Mercado
          </span>
          <div className="flex items-center space-x-4">
            <button
              onClick={onAutoRefreshToggle}
              className={`flex items-center px-3 py-1 rounded text-sm transition-colors ${
                autoRefresh ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'
              }`}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Auto
            </button>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${connectionColor}`}></div>
              <span className="text-sm text-gray-300">{connectionStatus}</span>
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Seletor Principal */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-300 mb-2 block">Selecionar Símbolo</label>
                <Select
                  options={filteredMarkets.map(market => ({
                    value: market.symbol,
                    label: `${market.symbol.replace('USDT', '')} / USDT`
                  }))}
                  value={selectedSymbol}
                  onChange={onSymbolChange}
                  searchable={true}
                  placeholder="Buscar símbolo..."
                />
              </div>
              
              {/* Informações do símbolo selecionado */}
              <div>
                {selectedMarket && (
                  <div>
                    <label className="text-sm text-gray-300 mb-2 block">Símbolo Selecionado</label>
                    <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-white font-semibold text-lg">
                          {selectedMarket.symbol.replace('USDT', '')}
                        </span>
                        <Badge className={`${selectedMarket.change24h >= 0 ? 'bg-green-500' : 'bg-red-500'}`}>
                          {selectedMarket.change24h >= 0 ? '+' : ''}{selectedMarket.change24h.toFixed(2)}%
                        </Badge>
                      </div>
                      <div className="text-2xl font-bold text-white mb-1">
                        ${selectedMarket.price.toFixed(selectedMarket.price > 1 ? 2 : 6)}
                      </div>
                      <div className="text-sm text-gray-400">
                        Vol: ${(selectedMarket.volume / 1000000).toFixed(1)}M
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Top Gainers/Losers */}
          <div className="space-y-4">
            {/* Top Gainers */}
            <div>
              <h4 className="text-sm font-medium text-green-400 mb-2">🚀 Maiores Altas</h4>
              <div className="space-y-2">
                {topGainers.map((market) => (
                  <div
                    key={market.symbol}
                    className="flex justify-between items-center p-2 bg-green-500/10 rounded cursor-pointer hover:bg-green-500/20 transition-colors"
                    onClick={() => onSymbolChange(market.symbol)}
                  >
                    <span className="text-white text-sm font-medium">
                      {market.symbol.replace('USDT', '')}
                    </span>
                    <Badge className="bg-green-500 text-xs">
                      +{market.change24h.toFixed(2)}%
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Losers */}
            <div>
              <h4 className="text-sm font-medium text-red-400 mb-2">📉 Maiores Baixas</h4>
              <div className="space-y-2">
                {topLosers.map((market) => (
                  <div
                    key={market.symbol}
                    className="flex justify-between items-center p-2 bg-red-500/10 rounded cursor-pointer hover:bg-red-500/20 transition-colors"
                    onClick={() => onSymbolChange(market.symbol)}
                  >
                    <span className="text-white text-sm font-medium">
                      {market.symbol.replace('USDT', '')}
                    </span>
                    <Badge className="bg-red-500 text-xs">
                      {market.change24h.toFixed(2)}%
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};