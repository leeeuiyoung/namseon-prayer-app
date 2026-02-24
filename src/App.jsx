import React, { useState, useRef, useEffect } from 'react';
import { Camera, Calendar, User, Heart, Send, Trophy, ArrowLeft, Image as ImageIcon, Users, MapPin, Loader2, AlertCircle } from 'lucide-react';

// Firebase 라이브러리 (인증 부분 제거, 데이터베이스만 사용)
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs } from 'firebase/firestore';

// 남선교회 실제 배포용 Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyC5p0TeHQFtk4Vew6i32d8Umd6DZq57TWs",
  authDomain: "manprayproject.firebaseapp.com",
  projectId: "manprayproject",
  storageBucket: "manprayproject.firebasestorage.app",
  messagingSenderId: "1067564375508",
  appId: "1:1067564375508:web:c56c787d9e3c7e59c24a41",
  measurementId: "G-GDW4BKJLY9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function App() {
  const [currentView, setCurrentView] = useState('form'); 
  const [isLoading, setIsLoading] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [modalMessage, setModalMessage] = useState('');

  const [formData, setFormData] = useState({
    cellName: '',
    name: '',
    position: '성도',
    date: new Date().toISOString().split('T')[0],
    prayerTopic: '',
    graceShared: '',
    photoPreview: null
  });

  const [errors, setErrors] = useState({});
  const fileInputRef = useRef(null);

  // 클라우드 데이터 불러오기 함수 (인증 절차 생략)
  const fetchSubmissions = async () => {
    try {
      setIsLoading(true);
      const colRef = collection(db, 'prayers');
      const data = await getDocs(colRef);
      
      const rawData = data.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
      
      // 최신순 정렬
      rawData.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
      setSubmissions(rawData);
    } catch (error) {
      console.error("데이터 로드 중 에러:", error);
      if (error.message.includes('Missing or insufficient permissions')) {
        setModalMessage("데이터베이스 권한이 막혀있습니다!\n\n파이어베이스 홈페이지 > Firestore Database > '규칙(Rules)' 탭에서\nallow read, write: if true;\n로 변경하고 '게시'를 눌러주세요.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 앱이 처음 켜질 때 즉시 데이터 로드
  useEffect(() => {
    fetchSubmissions();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // 용량 최적화
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        setFormData(prev => ({ ...prev, photoPreview: compressedBase64 }));
        if (errors.photoPreview) setErrors(prev => ({ ...prev, photoPreview: '' }));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const triggerFileInput = () => fileInputRef.current.click();

  const validateForm = () => {
    const newErrors = {};
    if (!formData.cellName.trim()) newErrors.cellName = '셀 이름을 입력해주세요.';
    if (!formData.name.trim()) newErrors.name = '이름을 입력해주세요.';
    if (!formData.date) newErrors.date = '인증 날짜를 선택해주세요.';
    if (!formData.photoPreview) newErrors.photoPreview = '성전 기도 인증 사진을 업로드해주세요.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      setIsLoading(true);
      try {
        const colRef = collection(db, 'prayers');
        await addDoc(colRef, {
          cellName: formData.cellName,
          name: formData.name,
          position: formData.position,
          date: formData.date,
          prayerTopic: formData.prayerTopic,
          graceShared: formData.graceShared,
          photoPreview: formData.photoPreview,
          submittedAt: new Date().toISOString()
        });
        
        await fetchSubmissions();
        setCurrentView('success');
        
        setFormData({
          cellName: '', name: '', position: '성도',
          date: new Date().toISOString().split('T')[0],
          prayerTopic: '', graceShared: '', photoPreview: null
        });
      } catch (error) {
        console.error("데이터 전송 중 에러:", error);
        if (error.message.includes('Missing or insufficient permissions')) {
          setModalMessage("업로드 권한이 막혀있습니다!\n\n파이어베이스 홈페이지 > Firestore 규칙(Rules) 설정을\n'allow read, write: if true;'\n로 변경해주세요.");
        } else {
          setModalMessage("업로드에 실패했습니다. 인터넷 연결을 다시 확인해주세요.");
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  const getLeaderboard = () => {
    const counts = {};
    submissions.forEach(sub => {
      const key = `${sub.cellName}-${sub.name}-${sub.position}`;
      if (!counts[key]) {
        counts[key] = {
          cellName: sub.cellName, name: sub.name, position: sub.position,
          count: 0, lastDate: sub.date
        };
      }
      counts[key].count += 1;
      if (new Date(sub.date) > new Date(counts[key].lastDate)) counts[key].lastDate = sub.date;
    });
    return Object.values(counts).sort((a, b) => b.count - a.count);
  };

  // 실시간 렌더링을 위한 랭킹 보드 데이터 산출
  const leaderboard = getLeaderboard();

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center font-sans">
      <div className="w-full max-w-md bg-white min-h-screen shadow-2xl relative">
        
        {/* 알림 모달 */}
        {modalMessage && (
          <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
              <div className="flex items-center mb-4 text-red-500">
                <AlertCircle className="w-6 h-6 mr-2" />
                <h3 className="text-lg font-bold text-gray-800">알림</h3>
              </div>
              <p className="text-gray-600 mb-6 whitespace-pre-wrap text-sm leading-relaxed">{modalMessage}</p>
              <button 
                onClick={() => setModalMessage('')} 
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl font-bold transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        )}

        {/* 로딩 오버레이 */}
        {isLoading && (
          <div className="fixed inset-0 bg-black/50 z-50 flex flex-col items-center justify-center backdrop-blur-sm">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
            <p className="text-white font-bold">클라우드와 통신 중입니다...</p>
          </div>
        )}

        {/* 1. 입력 폼 화면 */}
        {currentView === 'form' && (
          <div className="animate-fade-in pb-20">
            <div className="bg-blue-900 text-white p-6 rounded-b-3xl shadow-lg mb-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
              <div className="relative z-10 text-center">
                <p className="text-blue-200 text-sm font-medium mb-1 tracking-widest">남선교회 기도통장 이벤트</p>
                <h1 className="text-2xl font-bold leading-tight mb-2 text-yellow-500">
                  빛의 사자 남선교회<br/>성전기도 인증 프로젝트
                </h1>
                <p className="text-sm opacity-80 mt-2">기도의 자리를 지키는 당신을 축복합니다</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="px-5 space-y-6">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <User className="w-5 h-5 mr-2 text-blue-600" /> 기본 정보 <span className="text-red-500 ml-1 text-sm">*</span>
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">셀 이름</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <input type="text" name="cellName" value={formData.cellName} onChange={handleInputChange} placeholder="예: 믿음, 소망" className={`w-full pl-10 pr-4 py-3 bg-gray-50 border ${errors.cellName ? 'border-red-500' : 'border-gray-200'} rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500`} />
                    </div>
                    {errors.cellName && <p className="text-red-500 text-xs mt-1">{errors.cellName}</p>}
                  </div>
                  
                  <div className="flex space-x-3">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-600 mb-1">이름</label>
                      <input type="text" name="name" value={formData.name} onChange={handleInputChange} placeholder="홍길동" className={`w-full px-4 py-3 bg-gray-50 border ${errors.name ? 'border-red-500' : 'border-gray-200'} rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500`} />
                      {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                    </div>
                    <div className="w-32">
                      <label className="block text-sm font-medium text-gray-600 mb-1">직분</label>
                      <select name="position" value={formData.position} onChange={handleInputChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none">
                        <option value="성도">성도</option>
                        <option value="집사">집사</option>
                        <option value="권사">권사</option>
                        <option value="장로">장로</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-blue-600" /> 기도 인증 날짜 <span className="text-red-500 ml-1 text-sm">*</span>
                </h2>
                <input type="date" name="date" value={formData.date} onChange={handleInputChange} className={`w-full px-4 py-3 bg-gray-50 border ${errors.date ? 'border-red-500' : 'border-gray-200'} rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500`} />
                {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-800 mb-2 flex items-center"><Heart className="w-5 h-5 mr-2 text-blue-600" /> 나의 중보기도 제목</h2>
                  <textarea name="prayerTopic" value={formData.prayerTopic} onChange={handleInputChange} rows="3" placeholder="예: 우리 가정이 주님 안에서 하나되게 하소서..." className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"></textarea>
                </div>
                <div className="border-t border-gray-100 pt-6">
                  <h2 className="text-lg font-bold text-gray-800 mb-2 flex items-center"><Send className="w-5 h-5 mr-2 text-blue-600" /> 받은 감동 및 은혜나눔</h2>
                  <textarea name="graceShared" value={formData.graceShared} onChange={handleInputChange} rows="3" placeholder="자유롭게 적어주세요..." className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"></textarea>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <Camera className="w-5 h-5 mr-2 text-blue-600" /> 성전 기도 인증 사진 <span className="text-red-500 ml-1 text-sm">*</span>
                </h2>
                <div onClick={triggerFileInput} className={`relative w-full h-48 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all ${errors.photoPreview ? 'border-red-400 bg-red-50' : 'border-blue-200 bg-blue-50 hover:bg-blue-100'}`}>
                  {formData.photoPreview ? (
                    <img src={formData.photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <><div className="p-3 bg-blue-100 rounded-full mb-3 text-blue-600"><ImageIcon className="w-8 h-8" /></div><span className="text-blue-800 font-medium text-sm">여기를 눌러 사진 선택/촬영</span></>
                  )}
                </div>
                <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />
                {errors.photoPreview && <p className="text-red-500 text-xs mt-2 text-center">{errors.photoPreview}</p>}
              </div>
              <div className="h-4"></div>
            </form>

            <div className="fixed bottom-0 left-0 w-full p-4 bg-white border-t border-gray-200 shadow-[0_-4px_15px_rgba(0,0,0,0.05)] z-20">
              <div className="max-w-md mx-auto flex space-x-3">
                <button onClick={() => { fetchSubmissions(); setCurrentView('results'); }} className="flex-none px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold flex flex-col items-center justify-center active:bg-gray-200">
                  <Trophy className="w-5 h-5 mb-1" /><span className="text-[10px]">결과보기</span>
                </button>
                <button onClick={handleSubmit} disabled={isLoading} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-lg shadow-md hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-300 transition-colors">
                  인증 완료하기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. 성공 화면 뷰 */}
        {currentView === 'success' && (
          <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center animate-fade-in bg-gray-50">
            <div className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-6">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">인증이 완료되었습니다!</h2>
            <p className="text-gray-500 mb-8 max-w-[280px]">성도님의 귀한 기도가 하늘에 닿기를 소망합니다. 이벤트에 참여해 주셔서 감사합니다.</p>
            <div className="space-y-3 w-full max-w-xs">
              <button onClick={() => setCurrentView('results')} className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl font-bold shadow-md transition-colors">참여 결과 확인하기</button>
              <button onClick={() => setCurrentView('form')} className="w-full py-3 bg-white text-blue-600 border border-blue-200 hover:bg-blue-50 active:bg-blue-100 rounded-xl font-bold transition-colors">돌아가기</button>
            </div>
          </div>
        )}

        {/* 3. 랭킹/결과 화면 뷰 */}
        {currentView === 'results' && (
          <div className="min-h-screen bg-gray-50 animate-fade-in pb-10">
            <div className="bg-blue-900 text-white p-5 sticky top-0 z-30 shadow-md flex items-center justify-between">
              <button onClick={() => setCurrentView('form')} className="p-2 -ml-2 hover:bg-blue-800 active:bg-blue-700 rounded-lg transition-colors"><ArrowLeft className="w-6 h-6 text-blue-100" /></button>
              <h1 className="text-lg font-bold">참여 현황 및 순위</h1>
              <div className="w-10"></div>
            </div>

            <div className="p-5 space-y-6">
              <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
                <div className="flex items-center justify-center mb-6">
                  <Trophy className="w-8 h-8 text-yellow-500 mr-2" />
                  <h2 className="text-xl font-extrabold text-gray-800">이달의 기도 용사 Top</h2>
                </div>
                <div className="space-y-3">
                  {leaderboard.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">아직 인증된 내역이 없습니다.</p>
                  ) : (
                    leaderboard.map((person, index) => (
                      <div key={index} className="flex items-center p-3 rounded-xl bg-gray-50 border border-gray-100">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mr-4 shrink-0 ${index === 0 ? 'bg-yellow-100 text-yellow-600' : index === 1 ? 'bg-gray-200 text-gray-600' : index === 2 ? 'bg-orange-100 text-orange-600' : 'bg-blue-50 text-blue-500'}`}>{index + 1}</div>
                        <div className="flex-1">
                          <div className="flex items-baseline"><span className="font-bold text-gray-800 text-lg mr-2">{person.name}</span><span className="text-sm text-gray-500">{person.position}</span></div>
                          <div className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md inline-block mt-1">{person.cellName}셀</div>
                        </div>
                        <div className="text-right">
                          <div className="font-extrabold text-xl text-blue-600">{person.count}<span className="text-sm font-normal text-gray-500 ml-1">회</span></div>
                          <div className="text-[10px] text-gray-400">최근: {person.lastDate.substring(5)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center"><Users className="w-5 h-5 mr-2 text-blue-600" /> 최근 인증 현황</h2>
                <div className="grid grid-cols-2 gap-3">
                  {submissions.slice(0, 10).map((sub, idx) => (
                    <div key={idx} className="relative rounded-xl overflow-hidden aspect-square border border-gray-100 shadow-sm">
                      {sub.photoPreview && <img src={sub.photoPreview} alt="인증샷" className="w-full h-full object-cover" />}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex flex-col justify-end p-2">
                        <span className="text-white font-bold text-sm">{sub.name} {sub.position}</span>
                        <span className="text-gray-200 text-xs">{sub.date.substring(5)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
      `}} />
    </div>
  );
}
