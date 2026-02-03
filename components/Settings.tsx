import React, { useState } from 'react';
import { OzonCredentials } from '../types';
import { Key, Save, Lock, Info, Users, AlertCircle } from 'lucide-react';

interface SettingsProps {
  onSave: (creds: OzonCredentials[]) => void;
  initialCreds: OzonCredentials[];
}

const Settings: React.FC<SettingsProps> = ({ onSave, initialCreds }) => {
  // Format initial creds into a string for the textarea
  const initialText = initialCreds.map(c => `${c.clientId} ${c.apiKey}`).join('\n');
  const [bulkInput, setBulkInput] = useState(initialText);
  const [parsedCount, setParsedCount] = useState(initialCreds.length);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setBulkInput(text);
    
    // Preview parse count
    const lines = text.split('\n').filter(line => line.trim() !== '');
    setParsedCount(lines.length);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Parse Logic
    const newCreds: OzonCredentials[] = [];
    const lines = bulkInput.split('\n');
    
    lines.forEach(line => {
      // Split by comma, tab, or space
      // Also clean up any quotes that might have been copied from Excel/CSV (e.g. "12345")
      const cleanLine = line.replace(/['"]/g, ''); 
      const parts = cleanLine.trim().split(/[\s,\t]+/);
      
      // We expect at least two parts: ID and Key
      if (parts.length >= 2) {
        const clientId = parts[0].trim();
        const apiKey = parts[1].trim();
        if (clientId && apiKey) {
          newCreds.push({ clientId, apiKey });
        }
      }
    });

    if (newCreds.length === 0 && bulkInput.trim() !== '') {
      alert("无法识别数据格式，请确保每行包含 Client ID 和 API Key。");
      return;
    }

    onSave(newCreds);
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      
      {/* API Configuration */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                <Users size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">多店铺管理</h2>
              <p className="text-sm text-slate-500">支持批量导入，系统将自动汇总所有店铺数据</p>
            </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              批量导入凭证 (Client ID 和 API Key)
            </label>
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-2 text-sm text-slate-600">
              <p className="mb-2 font-semibold flex items-center gap-1"><Info size={14}/> 使用说明：</p>
              <ul className="list-disc list-inside space-y-1 ml-1 text-xs">
                <li>请直接粘贴两列数据（例如从Excel复制）。</li>
                <li>第一列为 <strong>Client ID</strong>，第二列为 <strong>API Key</strong>。</li>
                <li>系统会自动检测并忽略无法连接的店铺。</li>
              </ul>
            </div>
            
            <textarea
              value={bulkInput}
              onChange={handleInputChange}
              rows={10}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono text-sm leading-relaxed"
              placeholder={`123456  xxxxx-xxxx-xxxx-xxxx\n234567  yyyyy-yyyy-yyyy-yyyy`}
            />
            
            <div className="flex justify-between items-center mt-2">
               <span className="text-xs text-slate-500 flex items-center gap-1">
                 <Lock size={12}/> 数据仅保存在本地浏览器，安全无忧
               </span>
               <span className={`text-sm font-medium ${parsedCount > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                 已识别 {parsedCount} 个店铺
               </span>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <Save size={18} />
            保存并抓取所有店铺数据
          </button>
        </form>
      </div>

      {/* Notification URL Config (New Feature Placeholder) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 opacity-75">
        <div className="flex items-center gap-2 mb-4">
            <div className="bg-purple-100 p-2 rounded-lg text-purple-600">
                <AlertCircle size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-800">通知配置 (Webhooks)</h2>
        </div>
        <p className="text-sm text-slate-500 mb-4">
            如需接收实时订单通知，请在 Ozon 后台配置回调地址。本应用目前主要用于数据聚合分析。
        </p>
      </div>
    </div>
  );
};

export default Settings;