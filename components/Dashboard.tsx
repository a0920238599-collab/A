import React, { useMemo, useState, useEffect } from 'react';
import { OzonPosting, OzonCredentials } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, TooltipProps } from 'recharts';
import { Package, TrendingUp, DollarSign, Loader2, Box, Download, Layers, Archive, CheckCircle, CircleDashed, FileSpreadsheet } from 'lucide-react';
import { fetchPackageLabel } from '../services/ozonService';

interface DashboardProps {
  orders: OzonPosting[];
  loading: boolean;
}

const getCurrencySymbol = (code: string) => {
    switch (code?.toUpperCase()) {
        case 'CNY': return '¥';
        case 'USD': return '$';
        case 'RUB': return '₽';
        case 'EUR': return '€';
        default: return code;
    }
};

const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg">
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        <p className="text-sm text-blue-600">
          销售额: {getCurrencySymbol(data.currency)} {payload[0].value?.toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
};

const Dashboard: React.FC<DashboardProps> = ({ orders, loading }) => {
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'smart_group'>('list');
  
  // Local state for "Packed" status, persisted in localStorage
  const [packedOrderIds, setPackedOrderIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('ozon_packed_orders');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // Save packed status whenever it changes
  useEffect(() => {
    localStorage.setItem('ozon_packed_orders', JSON.stringify(Array.from(packedOrderIds)));
  }, [packedOrderIds]);

  // Get credentials list from local storage (supporting multi-store)
  const getCredentialsList = (): OzonCredentials[] => {
      const savedMulti = localStorage.getItem('ozon_creds_multi');
      if (savedMulti) return JSON.parse(savedMulti);

      const savedSingle = localStorage.getItem('ozon_creds');
      if (savedSingle) return [JSON.parse(savedSingle)];
      
      return [];
  };

  // Memoized calculations for stats
  const stats = useMemo(() => {
    const totalOrders = orders.length;
    
    // Group revenue by currency
    const revenueByCurrency: Record<string, { amount: number, count: number }> = {};
    const salesByDateAndCurrency: Record<string, Record<string, number>> = {}; // date -> currency -> amount

    orders.forEach(order => {
      const currency = order.products[0]?.currency_code || 'RUB'; 
      const orderTotal = order.financial_data?.products.reduce((sum, p) => sum + p.price, 0) || 
                         order.products.reduce((sum, p) => sum + parseFloat(p.price), 0);
      
      // Total Revenue Stats
      if (!revenueByCurrency[currency]) {
          revenueByCurrency[currency] = { amount: 0, count: 0 };
      }
      revenueByCurrency[currency].amount += orderTotal;
      revenueByCurrency[currency].count += 1;

      // Chart Data Aggregation
      const date = order.in_process_at.split('T')[0]; // YYYY-MM-DD
      if (!salesByDateAndCurrency[date]) {
          salesByDateAndCurrency[date] = {};
      }
      if (!salesByDateAndCurrency[date][currency]) {
          salesByDateAndCurrency[date][currency] = 0;
      }
      salesByDateAndCurrency[date][currency] += orderTotal;
    });

    // Find dominant currency for the chart (the one with highest total revenue)
    let dominantCurrency = 'RUB';
    let maxRevenue = -1;
    Object.entries(revenueByCurrency).forEach(([curr, data]) => {
        if (data.amount > maxRevenue) {
            maxRevenue = data.amount;
            dominantCurrency = curr;
        }
    });

    // Generate chart data
    const chartData = [];
    for (let i = 14; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const monthDay = dateStr.substring(5); // MM-DD
        
        const amount = salesByDateAndCurrency[dateStr]?.[dominantCurrency] || 0;
        
        chartData.push({
            date: monthDay,
            amount: amount,
            currency: dominantCurrency
        });
    }

    return { totalOrders, revenueByCurrency, chartData, dominantCurrency };
  }, [orders]);

  // Smart Grouping Logic: Filter single items and group by Offer ID
  const smartGroups = useMemo(() => {
      const groups: Record<string, { product: any, orders: OzonPosting[], currency: string }> = {};
      
      orders.forEach(order => {
          // Only consider orders with exactly 1 product line item
          if (order.products.length === 1) {
              const product = order.products[0];
              // Use offer_id as the grouping key
              const key = product.offer_id;
              
              if (!groups[key]) {
                  groups[key] = { product, orders: [], currency: product.currency_code || 'RUB' };
              }
              groups[key].orders.push(order);
          }
      });

      // Sort by number of orders (descending)
      return Object.values(groups).sort((a, b) => b.orders.length - a.orders.length);
  }, [orders]);

  const toggleSelectAll = () => {
      if (selectedOrders.size === orders.length) {
          setSelectedOrders(new Set());
      } else {
          setSelectedOrders(new Set(orders.map(o => o.posting_number)));
      }
  };

  const toggleSelect = (id: string) => {
      const newSelected = new Set(selectedOrders);
      if (newSelected.has(id)) {
          newSelected.delete(id);
      } else {
          newSelected.add(id);
      }
      setSelectedOrders(newSelected);
  };

  const handleDownloadLabels = async (ids: string[]) => {
      const credsList = getCredentialsList();
      if (credsList.length === 0 || ids.length === 0) return;

      setDownloading(true);
      try {
          // Group IDs by clientId (store)
          const ordersById = new Map<string, OzonPosting>(orders.map(o => [o.posting_number, o]));
          const groups: Record<string, string[]> = {};
          
          ids.forEach(id => {
              const order = ordersById.get(id);
              if (order && order.clientId) {
                  const cid = order.clientId;
                  if (!groups[cid]) groups[cid] = [];
                  groups[cid].push(id);
              } else {
                  // Fallback for mock data without clientId or legacy data
                  const firstCred = credsList[0];
                  if (firstCred) {
                    const defaultId = firstCred.clientId;
                    if (!groups[defaultId]) groups[defaultId] = [];
                    groups[defaultId].push(id);
                  }
              }
          });

          // Download individually for each store group (Browser might block multiple popups, so this is best effort)
          for (const [clientId, storeIds] of Object.entries(groups)) {
             const blob = await fetchPackageLabel(credsList, storeIds, clientId);
             const url = window.URL.createObjectURL(blob);
             const a = document.createElement('a');
             a.href = url;
             a.download = `ozon_labels_${clientId}_${new Date().getTime()}.pdf`; 
             document.body.appendChild(a);
             a.click();
             window.URL.revokeObjectURL(url);
             document.body.removeChild(a);
             
             // Small delay to prevent browser throttling downloads
             await new Promise(r => setTimeout(r, 500));
          }

      } catch (e) {
          console.error("Download failed", e);
          alert("下载失败，请检查网络或API配置");
      } finally {
          setDownloading(false);
      }
  };

  const togglePackedStatus = (ids: string[], status: boolean) => {
      const newPacked = new Set(packedOrderIds);
      ids.forEach(id => {
          if (status) newPacked.add(id);
          else newPacked.delete(id);
      });
      setPackedOrderIds(newPacked);
      // Clear selection after action for better UX
      if (ids.length > 1) setSelectedOrders(new Set());
  };

  const handleExportSmartGroups = () => {
    if (smartGroups.length === 0) return;

    // BOM for Excel utf-8 compatibility
    let csvContent = '\uFEFF';
    // Headers with Currency
    csvContent += '货号 (Offer ID),SKU,商品名称,单价,币种,总数量 (件),待打包订单,已打包订单\n';

    smartGroups.forEach(group => {
        // Calculate total quantity (sum of quantity field of the single product in each order)
        const totalQty = group.orders.reduce((sum, o) => sum + (o.products[0].quantity || 1), 0);
        
        const packedCount = group.orders.filter(o => packedOrderIds.has(o.posting_number)).length;
        const unpackedCount = group.orders.length - packedCount; 

        // Escape quotes in name
        const safeName = group.product.name.replace(/"/g, '""');
        
        // Use template literal for CSV row
        csvContent += `${group.product.offer_id},${group.product.sku},"${safeName}",${group.product.price},${group.currency},${totalQty},${unpackedCount},${packedCount}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ozon_smart_picking_list_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
        <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
        <p className="text-slate-500 font-medium">正在聚合多店铺数据...</p>
      </div>
    );
  }

  const currencyKeys = Object.keys(stats.revenueByCurrency);

  return (
    <div className="space-y-6">
      
      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg shadow-blue-200">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <p className="text-blue-100 text-sm font-medium mb-2">总销售额 (按币种)</p>
              {currencyKeys.length > 0 ? (
                  <div className="space-y-1">
                      {currencyKeys.map(curr => (
                          <div key={curr} className="flex items-baseline gap-2">
                              <h3 className="text-2xl font-bold">
                                  {getCurrencySymbol(curr)} {stats.revenueByCurrency[curr].amount.toLocaleString()}
                              </h3>
                              <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded text-white/90">{curr}</span>
                          </div>
                      ))}
                  </div>
              ) : (
                  <h3 className="text-3xl font-bold">¥ 0</h3>
              )}
            </div>
            <div className="bg-white/20 p-2 rounded-lg ml-4">
              <DollarSign size={24} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-sm font-medium mb-1">总订单数</p>
              <h3 className="text-3xl font-bold text-slate-800">{stats.totalOrders}</h3>
            </div>
            <div className="bg-purple-100 p-2 rounded-lg text-purple-600">
              <Package size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
           <div className="flex justify-between items-start">
            <div className="flex-1">
              <p className="text-slate-500 text-sm font-medium mb-2">平均客单价</p>
              {currencyKeys.length > 0 ? (
                  <div className="space-y-1">
                      {currencyKeys.map(curr => {
                          const { amount, count } = stats.revenueByCurrency[curr];
                          const avg = count > 0 ? Math.round(amount / count) : 0;
                          return (
                            <div key={curr} className="flex items-baseline gap-2">
                                <h3 className="text-xl font-bold text-slate-800">
                                    {getCurrencySymbol(curr)} {avg.toLocaleString()}
                                </h3>
                                <span className="text-xs text-slate-400">{curr}</span>
                            </div>
                          );
                      })}
                  </div>
              ) : (
                  <h3 className="text-3xl font-bold text-slate-800">0</h3>
              )}
            </div>
            <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600 ml-4">
              <TrendingUp size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart Section (Full width) */}
        <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-800">近15日销售趋势</h3>
            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded">
                显示主营币种: {stats.dominantCurrency}
            </span>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip content={<CustomTooltip />} cursor={{fill: '#f1f5f9'}} />
                <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex items-center gap-4 border-b border-slate-200">
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
                viewMode === 'list' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
              <Box size={18} /> 所有订单
          </button>
          <button
            onClick={() => setViewMode('smart_group')}
            className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
                viewMode === 'smart_group' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
              <Layers size={18} /> 智能合单 (单品)
          </button>
      </div>

      {/* Tab Content */}
      {viewMode === 'list' ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 w-full sm:w-auto">
                <h3 className="font-bold text-slate-800">订单列表</h3>
                {selectedOrders.size > 0 && (
                    <span className="text-sm text-slate-500 bg-slate-100 px-2 py-1 rounded">
                        已选择 {selectedOrders.size} 项
                    </span>
                )}
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
                <button 
                    onClick={() => togglePackedStatus(Array.from(selectedOrders), true)}
                    disabled={selectedOrders.size === 0}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-sm bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <CheckCircle size={16} /> 设为已打包
                </button>
                <button 
                    onClick={() => togglePackedStatus(Array.from(selectedOrders), false)}
                    disabled={selectedOrders.size === 0}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-sm bg-slate-50 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <CircleDashed size={16} /> 撤销打包
                </button>
                <button 
                    onClick={() => handleDownloadLabels(Array.from(selectedOrders))}
                    disabled={selectedOrders.size === 0 || downloading}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {downloading ? <Loader2 size={16} className="animate-spin"/> : <Download size={16} />}
                    下载面单
                </button>
            </div>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-medium">
                <tr>
                    <th className="px-6 py-3 w-12">
                        <input 
                            type="checkbox" 
                            checked={orders.length > 0 && selectedOrders.size === orders.length}
                            onChange={toggleSelectAll}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                    </th>
                    <th className="px-6 py-3">打包状态</th>
                    <th className="px-6 py-3">店铺 ID</th>
                    <th className="px-6 py-3">订单号</th>
                    <th className="px-6 py-3 w-80">商品信息</th>
                    <th className="px-6 py-3">金额</th>
                    <th className="px-6 py-3">Ozon 状态</th>
                    <th className="px-6 py-3">操作</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                {orders.slice(0, 50).map((order) => {
                    const price = order.products.reduce((s, p) => s + parseFloat(p.price), 0);
                    const isSelected = selectedOrders.has(order.posting_number);
                    const isPacked = packedOrderIds.has(order.posting_number);
                    const mainProduct = order.products[0];
                    const currency = mainProduct?.currency_code || '';

                    return (
                    <tr key={order.posting_number} className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}>
                    <td className="px-6 py-4">
                        <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={() => toggleSelect(order.posting_number)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                    </td>
                    <td className="px-6 py-4">
                        {isPacked ? (
                            <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-full text-xs font-medium w-fit">
                                <CheckCircle size={12} /> 已打包
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-slate-500 bg-slate-100 px-2 py-1 rounded-full text-xs font-medium w-fit">
                                <CircleDashed size={12} /> 未打包
                            </span>
                        )}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{order.clientId || '-'}</td>
                    <td className="px-6 py-4 font-mono text-slate-600">{order.posting_number}</td>
                    <td className="px-6 py-4">
                        <div className="flex gap-3">
                            <div className="flex flex-col gap-1 min-w-0">
                                <span className="text-slate-800 font-medium text-sm leading-tight" title={mainProduct?.name}>
                                    {mainProduct?.name || 'Unknown Product'}
                                    {order.products.length > 1 && <span className="text-xs text-slate-400 ml-1">+{order.products.length - 1}</span>}
                                </span>
                                {mainProduct && (
                                    <div className="text-xs text-slate-500 flex flex-col space-y-0.5 mt-1">
                                        <span>货号: <span className="font-mono text-slate-600">{mainProduct.offer_id}</span></span>
                                        <span>SKU: <span className="font-mono text-slate-600">{mainProduct.sku}</span></span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">
                        {getCurrencySymbol(currency)} {price.toLocaleString()} <span className="text-xs text-slate-400 font-normal">{currency}</span>
                    </td>
                    <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border
                        ${order.status === 'delivered' ? 'bg-green-50 text-green-700 border-green-200' : 
                            order.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                            'bg-blue-50 text-blue-700 border-blue-200'}`}>
                        {order.status}
                        </span>
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex gap-2">
                             <button 
                                onClick={() => handleDownloadLabels([order.posting_number])}
                                className="text-blue-600 hover:text-blue-800 p-1.5 hover:bg-blue-50 rounded transition-colors"
                                title="下载面单"
                            >
                                <Download size={18} />
                            </button>
                            <button
                                onClick={() => togglePackedStatus([order.posting_number], !isPacked)}
                                className={`p-1.5 rounded transition-colors ${isPacked ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100' : 'text-green-600 hover:text-green-700 hover:bg-green-50'}`}
                                title={isPacked ? "撤销打包" : "设为已打包"}
                            >
                                {isPacked ? <Archive size={18} /> : <CheckCircle size={18} />}
                            </button>
                        </div>
                    </td>
                    </tr>
                )})}
                {orders.length === 0 && (
                    <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                        暂无订单数据
                    </td>
                    </tr>
                )}
                </tbody>
            </table>
            </div>
        </div>
      ) : (
          /* Smart Grouping View */
          <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-center gap-3 text-blue-800 text-sm flex-1">
                      <InfoIcon size={20} />
                      <p>智能合单已自动筛选出所有“单品订单”，并按照相同的货号归类，方便您统一打包发货。</p>
                  </div>
                  <button 
                    onClick={handleExportSmartGroups}
                    disabled={smartGroups.length === 0}
                    className="flex items-center justify-center gap-2 px-6 py-4 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors shadow-sm shrink-0"
                  >
                     <FileSpreadsheet size={20} />
                     导出配货单
                  </button>
              </div>

              {smartGroups.map((group, index) => {
                  const packedCount = group.orders.filter(o => packedOrderIds.has(o.posting_number)).length;
                  const unpackedCount = group.orders.length - packedCount;
                  const allPacked = unpackedCount === 0;

                  return (
                    <div key={group.product.offer_id + index} className={`bg-white rounded-xl shadow-sm border p-6 transition-all ${allPacked ? 'border-green-200 bg-green-50/30' : 'border-slate-200 hover:border-blue-300'}`}>
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex-1 flex gap-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <h4 className="font-bold text-slate-800 text-lg">{group.product.name}</h4>
                                        {allPacked && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">全部已打包</span>}
                                    </div>
                                    <div className="flex flex-wrap gap-4 text-sm text-slate-600 mb-2">
                                        <span className="bg-slate-100 px-2 py-1 rounded">货号: <span className="font-mono font-medium">{group.product.offer_id}</span></span>
                                        <span className="bg-slate-100 px-2 py-1 rounded">SKU: <span className="font-mono font-medium">{group.product.sku}</span></span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded font-medium text-xs">共 {group.orders.length} 单</span>
                                        <span className="text-slate-400 text-xs">({unpackedCount} 待打包, {packedCount} 已打包)</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 shrink-0">
                                <button 
                                    onClick={() => togglePackedStatus(group.orders.map(o => o.posting_number), true)}
                                    disabled={allPacked}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-lg font-medium transition-colors text-sm"
                                >
                                    <CheckCircle size={16} /> 
                                    全部设为已打包
                                </button>
                                <button 
                                    onClick={() => handleDownloadLabels(group.orders.map(o => o.posting_number))}
                                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium transition-colors text-sm"
                                >
                                    {downloading ? <Loader2 size={16} className="animate-spin"/> : <Download size={16} />}
                                    批量下载面单 ({group.orders.length})
                                </button>
                            </div>
                        </div>
                    </div>
                  );
              })}
              
              {smartGroups.length === 0 && (
                  <div className="text-center py-12 bg-white rounded-xl border border-slate-200 border-dashed">
                      <p className="text-slate-500">暂无符合条件的单品订单。</p>
                  </div>
              )}
          </div>
      )}

    </div>
  );
};

// Helper component for the Info icon inside Smart Grouping view
const InfoIcon = ({ size }: { size: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
);

export default Dashboard;