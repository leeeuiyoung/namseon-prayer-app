import React, { useState, useRef, useEffect } from 'react';
import { Camera, Calendar, User, Heart, Send, Trophy, ArrowLeft, Image as ImageIcon, Users, MapPin, Loader2, AlertCircle, Settings, Trash2, Lock, Edit2, X, ZoomIn, Search } from 'lucide-react';

// Firebase 라이브러리
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, doc, deleteDoc, updateDoc, getDoc, setDoc } from 'firebase/firestore';

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

// 로컬 시간 기준의 오늘 날짜(YYYY-MM-DD)를 가져오는 헬퍼 함수
const getLocalTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function App() {
  const [currentView, setCurrentView] = useState('form'); // 'form' | 'success' | 'results' | 'admin'
  const [isLoading, setIsLoading] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  
  // 모달 상태 관리 (alert, confirm 대체)
  const [modalMessage, setModalMessage] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: '', confirmText: '확인', isDestructive: false, onConfirm: null });

  // 폼 상태
  const [formData, setFormData] = useState({
    cellName: '',
    name: '',
    position: '성도',
    date: getLocalTodayDate(),
    photoPreview: null
  });
  const [errors, setErrors] = useState({});
  const fileInputRef = useRef(null);
  const adminFileInputRef = useRef(null); // 관리자 사진 수정용 Ref 추가

  // 페이지네이션 상태
  const [leaderboardPage, setLeaderboardPage] = useState(1);
  const [recentPage, setRecentPage] = useState(1);
  const [adminPage, setAdminPage] = useState(1); // 관리자 전체 기록 페이지 상태 추가

  // 관리자 상태
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPwdInput, setAdminPwdInput] = useState('');
  const [adminSearchQuery, setAdminSearchQuery] = useState(''); // 관리자 검색어 상태 추가
  const ADMIN_PASSWORD = '7777'; // 관리자 접속 비밀번호

  // 검색어가 변경될 때마다 관리자 페이지를 1페이지로 리셋
  useEffect(() => {
    setAdminPage(1);
  }, [adminSearchQuery]);

  // 관리자 수정 상태
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  // 사진 크게 보기 상태 (추가됨)
  const [selectedImage, setSelectedImage] = useState(null);

  // 앱 설정 (이달의 기도용사 표시 여부)
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // 화면이 전환될 때마다 무조건 스크롤을 맨 위로 올려주는 기능 (추가됨)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentView]);

  // 관리자용 사진 업로드 핸들러
  const handleAdminPhotoUpload = (e) => {
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

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        setEditFormData(prev => ({ ...prev, photoPreview: compressedBase64 }));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const triggerAdminFileInput = () => {
    if (adminFileInputRef.current) adminFileInputRef.current.click();
  };

  // 클라우드 데이터 불러오기
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

  // 설정 데이터 불러오기 (랭킹 표시 여부)
  const fetchSettings = async () => {
    try {
      const docRef = doc(db, 'settings', 'config');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setShowLeaderboard(docSnap.data().showLeaderboard);
      } else {
        // 처음 실행 시 기본값(숨김) 설정 생성
        await setDoc(docRef, { showLeaderboard: false });
      }
    } catch (error) {
      console.error("설정 로드 중 에러:", error);
    }
  };

  useEffect(() => {
    fetchSubmissions();
    fetchSettings();
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

  // 실제 업로드를 수행하는 분리된 함수
  const executeSubmit = async () => {
    setIsLoading(true);
    try {
      const colRef = collection(db, 'prayers');
      
      // "셀" 글자 중복 방지 처리 (예: "요한셀" 또는 "요한 셀" -> "요한"으로 통일하여 저장)
      const normalizedCellName = formData.cellName.trim().replace(/\s*셀$/, '').trim();

      await addDoc(colRef, {
        cellName: normalizedCellName,
        name: formData.name,
        position: formData.position,
        date: formData.date,
        photoPreview: formData.photoPreview,
        submittedAt: new Date().toISOString()
      });
      
      await fetchSubmissions();
      setCurrentView('success');
      
      setFormData({
        cellName: '', name: '', position: '성도',
        date: getLocalTodayDate(),
        photoPreview: null
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
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      const todayStr = getLocalTodayDate();
      
      // 선택한 날짜가 오늘보다 과거일 경우 확인 모달 띄우기
      if (formData.date < todayStr) {
        setConfirmDialog({
          isOpen: true,
          message: `오늘은 ${todayStr}입니다.\n선택하신 날짜는 ${formData.date}입니다.\n\n지난 날짜(전날 등)의 인증샷을 올리시는 게 맞나요?`,
          confirmText: '네, 올립니다',
          isDestructive: false,
          onConfirm: () => {
            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
            executeSubmit(); // '네'를 누르면 정상적으로 과거 날짜로 업로드가 허용됨
          }
        });
      } else {
        // 날짜가 오늘이거나 미래인 경우 즉시 업로드 진행
        executeSubmit();
      }
    }
  };

  // 관리자 데이터 삭제 함수
  const executeDelete = async (id) => {
    setConfirmDialog({ ...confirmDialog, isOpen: false });
    setIsLoading(true);
    try {
      await deleteDoc(doc(db, 'prayers', id));
      await fetchSubmissions();
      setModalMessage("기록이 성공적으로 삭제되었습니다.");
    } catch (error) {
      console.error("삭제 중 에러:", error);
      setModalMessage("삭제에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (id) => {
    setConfirmDialog({
      isOpen: true,
      message: "이 인증 기록을 정말 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.",
      confirmText: '삭제',
      isDestructive: true,
      onConfirm: () => executeDelete(id)
    });
  };

  // 관리자 데이터 수정 시작
  const startEditing = (sub) => {
    setEditingId(sub.id);
    setEditFormData({
      cellName: sub.cellName || '',
      name: sub.name || '',
      position: sub.position || '성도',
      date: sub.date || '',
      photoPreview: sub.photoPreview || null, // 사진 데이터 상태 포함
    });
  };

  // 관리자 데이터 수정 취소
  const cancelEditing = () => {
    setEditingId(null);
    setEditFormData({});
  };

  // 관리자 데이터 수정 입력 처리
  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({ ...prev, [name]: value }));
  };

  // 관리자 데이터 수정 저장
  const saveEdit = async () => {
    if (!editFormData.cellName.trim() || !editFormData.name.trim() || !editFormData.date) {
      setModalMessage("필수 정보(셀, 이름, 날짜)를 모두 입력해주세요.");
      return;
    }
    if (!editFormData.photoPreview) {
      setModalMessage("성전 기도 인증 사진을 등록해주세요.");
      return;
    }
    setIsLoading(true);
    try {
      const docRef = doc(db, 'prayers', editingId);
      // 수정 시에도 "셀" 글자 중복 처리 적용
      const normalizedCellName = editFormData.cellName.trim().replace(/\s*셀$/, '').trim();
      
      await updateDoc(docRef, {
        cellName: normalizedCellName,
        name: editFormData.name,
        position: editFormData.position,
        date: editFormData.date,
        photoPreview: editFormData.photoPreview, // 교체된 사진 데이터 반영
      });
      await fetchSubmissions();
      setModalMessage("기록이 성공적으로 수정되었습니다.");
      setEditingId(null);
    } catch (error) {
      console.error("수정 중 에러:", error);
      setModalMessage("수정에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 관리자 설정: 기도용사 표시 토글
  const toggleLeaderboard = async () => {
    setIsLoading(true);
    try {
      const newState = !showLeaderboard;
      await setDoc(doc(db, 'settings', 'config'), { showLeaderboard: newState }, { merge: true });
      setShowLeaderboard(newState);
      setModalMessage(`이달의 기도용사가 화면에 ${newState ? '표시됩니다.' : '숨겨집니다.'}`);
    } catch (error) {
      console.error("설정 변경 에러:", error);
      setModalMessage("설정 변경에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 관리자 전체 데이터 삭제 함수
  const executeDeleteAll = async () => {
    setConfirmDialog({ ...confirmDialog, isOpen: false });
    setIsLoading(true);
    try {
      const promises = submissions.map(sub => deleteDoc(doc(db, 'prayers', sub.id)));
      await Promise.all(promises);
      await fetchSubmissions();
      setModalMessage("모든 데이터가 성공적으로 초기화되었습니다.");
    } catch (error) {
      console.error("초기화 에러:", error);
      setModalMessage("데이터 초기화에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAllClick = () => {
    setConfirmDialog({
      isOpen: true,
      message: "⚠️ 정말 모든 인증 기록을 초기화하시겠습니까?\n이 작업은 절대 되돌릴 수 없으며, 모든 사진과 기록이 영구 삭제됩니다.",
      confirmText: '전체 삭제',
      isDestructive: true,
      onConfirm: executeDeleteAll
    });
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

  const leaderboard = getLeaderboard();

  // 페이지네이션 렌더링 헬퍼 함수
  const renderPagination = (currentPage, totalItems, itemsPerPage, setPageFn) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) return null;

    return (
      <div className="flex flex-wrap justify-center gap-2 mt-6">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
          <button
            key={pageNum}
            onClick={() => setPageFn(pageNum)}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
              currentPage === pageNum 
                ? 'bg-blue-600 text-white shadow-md transform scale-110' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {pageNum}
          </button>
        ))}
      </div>
    );
  };

  // 공통 UI 컴포넌트들
  const LoadingOverlay = () => (
    <div className="fixed inset-0 bg-black/50 z-[100] flex flex-col items-center justify-center backdrop-blur-sm">
      <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
      <p className="text-white font-bold">처리 중입니다...</p>
    </div>
  );

  const AlertModal = () => {
    if (!modalMessage) return null;
    return (
      <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
          <div className="flex items-center mb-4 text-blue-600">
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
    );
  };

  const ConfirmModal = () => {
    if (!confirmDialog.isOpen) return null;
    return (
      <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
          <div className={`flex items-center mb-4 ${confirmDialog.isDestructive ? 'text-red-500' : 'text-blue-600'}`}>
            <AlertCircle className="w-6 h-6 mr-2" />
            <h3 className="text-lg font-bold text-gray-800">확인</h3>
          </div>
          <p className="text-gray-600 mb-6 whitespace-pre-wrap text-sm leading-relaxed">{confirmDialog.message}</p>
          <div className="flex gap-3">
            <button 
              onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })} 
              className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors"
            >
              취소
            </button>
            <button 
              onClick={confirmDialog.onConfirm} 
              className={`flex-1 py-3 text-white rounded-xl font-bold transition-colors ${confirmDialog.isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {confirmDialog.confirmText || '확인'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 이미지 확대 보기 모달 (추가됨)
  const ImageModal = () => {
    if (!selectedImage) return null;
    return (
      <div 
        className="fixed inset-0 bg-black/85 z-[120] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in cursor-pointer"
        onClick={() => setSelectedImage(null)}
      >
        <button 
          onClick={() => setSelectedImage(null)}
          className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full transition-all z-10"
        >
          <X className="w-6 h-6" />
        </button>
        <div 
          className="relative max-w-full max-h-[90vh] flex items-center justify-center cursor-default" 
          onClick={(e) => e.stopPropagation()}
        >
          <img 
            src={selectedImage} 
            alt="확대된 인증샷" 
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
          />
        </div>
      </div>
    );
  };

  // --- 화면 뷰 컴포넌트들 ---

  const FormView = () => (
    <div className="animate-fade-in pb-20 relative">
      <div className="bg-blue-900 text-white p-6 rounded-b-3xl shadow-lg mb-6 relative overflow-hidden">
        {/* 관리자 페이지 진입 버튼 (우측 상단 톱니바퀴) */}
        <button 
          onClick={() => setCurrentView('admin')}
          className="absolute top-4 right-4 z-20 p-2 text-blue-200 hover:text-white transition-colors rounded-full hover:bg-blue-800/50"
        >
          <Settings className="w-5 h-5" />
        </button>

        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
        <div className="relative z-10 text-center mt-2">
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
  );

  const SuccessView = () => (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center animate-fade-in bg-gray-50">
      <div className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-6">
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
      </div>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">인증이 완료되었습니다!</h2>
      <p className="text-gray-500 mb-8 max-w-[280px]">성도님의 귀한 기도가 하늘에 닿기를 소망합니다. 이벤트에 참여해 주셔서 감사합니다.</p>
      <div className="space-y-3 w-full max-w-xs">
        <button onClick={() => { setLeaderboardPage(1); setRecentPage(1); setCurrentView('results'); }} className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl font-bold shadow-md transition-colors">참여 결과 확인하기</button>
        <button onClick={() => setCurrentView('form')} className="w-full py-3 bg-white text-blue-600 border border-blue-200 hover:bg-blue-50 active:bg-blue-100 rounded-xl font-bold transition-colors">돌아가기</button>
      </div>
    </div>
  );

  const ResultsView = () => {
    // 페이지에 맞는 데이터 슬라이싱 (10개씩 / 4개씩)
    const paginatedLeaderboard = leaderboard.slice((leaderboardPage - 1) * 10, leaderboardPage * 10);
    const paginatedRecent = submissions.slice((recentPage - 1) * 4, recentPage * 4);
    
    // 화면 깜빡임 방지를 위해 항상 4개의 슬롯 유지 (데이터가 부족하면 null 채움)
    const paddedRecent = [...paginatedRecent];
    if (submissions.length > 0) {
      while (paddedRecent.length < 4) {
        paddedRecent.push(null);
      }
    }

    return (
      <div className="min-h-screen bg-gray-50 animate-fade-in pb-10">
        <div className="bg-blue-900 text-white p-5 sticky top-0 z-30 shadow-md flex items-center justify-between">
          <button onClick={() => setCurrentView('form')} className="p-2 -ml-2 hover:bg-blue-800 active:bg-blue-700 rounded-lg transition-colors"><ArrowLeft className="w-6 h-6 text-blue-100" /></button>
          <h1 className="text-lg font-bold">참여 현황 및 순위</h1>
          <div className="w-10"></div>
        </div>

        <div className="p-5 space-y-6">
          {/* 이달의 기도 용사 (설정에 따라 표시/숨김 처리) */}
          {showLeaderboard && (
            <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
              <div className="flex items-center justify-center mb-6">
                <Trophy className="w-8 h-8 text-yellow-500 mr-2" />
                <h2 className="text-xl font-extrabold text-gray-800">이달의 기도 용사 Top</h2>
              </div>
              <div className="space-y-2">
                {leaderboard.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">아직 인증된 내역이 없습니다.</p>
                ) : (
                  paginatedLeaderboard.map((person, idx) => {
                    const actualRank = (leaderboardPage - 1) * 10 + idx + 1;
                    return (
                      <div key={actualRank} className="flex items-center px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
                        <div className={`w-7 h-7 text-sm rounded-full flex items-center justify-center font-bold mr-3 shrink-0 ${actualRank === 1 ? 'bg-yellow-100 text-yellow-600' : actualRank === 2 ? 'bg-gray-200 text-gray-600' : actualRank === 3 ? 'bg-orange-100 text-orange-600' : 'bg-blue-50 text-blue-500'}`}>{actualRank}</div>
                        <div className="flex-1">
                          <div className="flex items-center flex-wrap gap-1.5">
                            <span className="font-bold text-gray-800 text-base">{person.name}</span>
                            <span className="text-xs text-gray-500">{person.position}</span>
                            <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md">{person.cellName}셀</span>
                          </div>
                        </div>
                        <div className="text-right leading-tight">
                          <div className="font-extrabold text-lg text-blue-600">{person.count}<span className="text-xs font-normal text-gray-500 ml-0.5">회</span></div>
                          <div className="text-[9px] text-gray-400">최근: {person.lastDate.substring(5)}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {/* 랭킹 페이지네이션 */}
              {renderPagination(leaderboardPage, leaderboard.length, 10, setLeaderboardPage)}
            </div>
          )}

          {/* 최근 인증 현황 (4개씩 페이징) */}
          <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center"><Users className="w-5 h-5 mr-2 text-blue-600" /> 최근 인증 현황</h2>
            <div className="grid grid-cols-2 gap-3">
              {submissions.length === 0 ? (
                <p className="text-center text-gray-500 py-4 col-span-2">아직 인증된 내역이 없습니다.</p>
              ) : (
                paddedRecent.map((sub, idx) => (
                  sub ? (
                    <div 
                      key={sub.id || idx} 
                      onClick={() => sub.photoPreview && setSelectedImage(sub.photoPreview)}
                      className="relative rounded-xl overflow-hidden aspect-square border border-gray-100 shadow-sm bg-gray-100 group cursor-pointer"
                    >
                      {sub.photoPreview && <img src={sub.photoPreview} alt="인증샷" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex flex-col justify-end p-2 z-10">
                        <span className="text-white font-bold text-sm">{sub.name} {sub.position}</span>
                        <span className="text-gray-200 text-xs">{sub.date.substring(5)}</span>
                      </div>
                      
                      {/* 마우스 호버 시 돋보기 아이콘 효과 */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 z-20">
                        <div className="bg-black/50 p-2 rounded-full backdrop-blur-sm transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                          <ZoomIn className="w-6 h-6 text-white" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* 빈 슬롯 유지용 투명 박스 */
                    <div key={`empty-${idx}`} className="relative rounded-xl aspect-square pointer-events-none"></div>
                  )
                ))
              )}
            </div>
            {/* 최근 인증 페이지네이션 */}
            {renderPagination(recentPage, submissions.length, 4, setRecentPage)}
          </div>
        </div>
      </div>
    );
  };

  const AdminView = () => {
    // 로그인 안된 상태면 비밀번호 입력 폼 노출
    if (!isAdmin) {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 animate-fade-in">
          <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-sm text-center">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">관리자 로그인</h2>
            <p className="text-sm text-gray-500 mb-6">데이터 관리를 위해 비밀번호를 입력하세요.</p>
            
            <input 
              type="password" 
              placeholder="비밀번호" 
              value={adminPwdInput}
              onChange={(e) => setAdminPwdInput(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 text-center"
            />
            
            <button 
              onClick={() => {
                if (adminPwdInput === ADMIN_PASSWORD) {
                  setIsAdmin(true);
                  setAdminPwdInput('');
                } else {
                  setModalMessage("비밀번호가 일치하지 않습니다.");
                }
              }}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md transition-colors mb-3"
            >
              접속하기
            </button>
            <button 
              onClick={() => { setCurrentView('form'); setAdminPwdInput(''); }}
              className="w-full py-3 bg-white text-gray-500 font-medium transition-colors"
            >
              메인으로 돌아가기
            </button>
          </div>
        </div>
      );
    }

    // 검색어에 따른 결과 필터링
    const filteredAdminSubmissions = submissions.filter(sub => 
      (sub.name && sub.name.includes(adminSearchQuery)) || 
      (sub.cellName && sub.cellName.includes(adminSearchQuery))
    );

    // 관리자 로그인 성공 시 대시보드
    return (
      <div className="min-h-screen bg-gray-50 animate-fade-in pb-10">
        <div className="bg-slate-800 text-white p-5 sticky top-0 z-30 shadow-md flex items-center justify-between">
          <button onClick={() => setCurrentView('form')} className="p-2 -ml-2 hover:bg-slate-700 rounded-lg transition-colors"><ArrowLeft className="w-6 h-6 text-slate-200" /></button>
          <h1 className="text-lg font-bold">관리자 대시보드</h1>
          <button onClick={() => setIsAdmin(false)} className="text-xs bg-slate-700 px-3 py-1 rounded-full text-slate-200">로그아웃</button>
        </div>

        <div className="p-5 space-y-6">
          {/* 관리자 설정 컨트롤 패널 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-bold text-gray-800 mb-4 flex items-center"><Settings className="w-5 h-5 mr-2 text-slate-600" /> 이벤트 설정 관리</h2>
            
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <h3 className="font-bold text-sm text-gray-800">이달의 기도용사 랭킹 공개</h3>
                  <p className="text-xs text-gray-500 mt-0.5">결과보기 화면에 랭킹을 표시합니다.</p>
                </div>
                <button 
                  onClick={toggleLeaderboard}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${showLeaderboard ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                >
                  {showLeaderboard ? '공개 중 (숨기기)' : '숨김 상태 (공개하기)'}
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100">
                <div>
                  <h3 className="font-bold text-sm text-red-700">모든 데이터 초기화</h3>
                  <p className="text-xs text-red-500 mt-0.5">저장된 모든 사진과 기록을 삭제합니다.</p>
                </div>
                <button 
                  onClick={handleDeleteAllClick}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold transition-colors"
                >
                  전체 삭제
                </button>
              </div>
            </div>
          </div>

          {/* 관리자 열람용 랭킹 (추가된 부분) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-bold text-gray-800 flex items-center"><Trophy className="w-5 h-5 mr-2 text-yellow-500" /> 기도용사 랭킹 (관리자 열람용)</h2>
            </div>
            <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
              {leaderboard.length === 0 ? (
                <p className="text-center text-gray-500 py-8">아직 인증된 내역이 없습니다.</p>
              ) : (
                leaderboard.map((person, idx) => {
                  const actualRank = idx + 1;
                  return (
                    <div key={actualRank} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 text-sm rounded-full flex items-center justify-center font-bold shrink-0 ${actualRank === 1 ? 'bg-yellow-100 text-yellow-600' : actualRank === 2 ? 'bg-gray-200 text-gray-600' : actualRank === 3 ? 'bg-orange-100 text-orange-600' : 'bg-blue-50 text-blue-500'}`}>{actualRank}</div>
                        <div>
                          <div className="font-bold text-gray-900">{person.name} <span className="text-xs text-gray-500 font-normal">{person.position}</span></div>
                          <div className="text-xs text-blue-600">{person.cellName}셀</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-blue-600">{person.count}회</div>
                        <div className="text-[10px] text-gray-400">최근: {person.lastDate.substring(5)}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 전체 인증 기록 관리 영역 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-gray-100 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
              <h2 className="font-bold text-gray-800 shrink-0">전체 인증 기록 ({filteredAdminSubmissions.length}건)</h2>
              <div className="relative w-full sm:w-48">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="이름 또는 셀 검색..."
                  value={adminSearchQuery}
                  onChange={(e) => setAdminSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                />
              </div>
            </div>
            {/* 관리자 이미지 업로드용 숨김 인풋 */}
            <input type="file" ref={adminFileInputRef} onChange={handleAdminPhotoUpload} accept="image/*" className="hidden" />
            
            <div className="divide-y divide-gray-100">
              {filteredAdminSubmissions.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  {adminSearchQuery ? '검색된 기록이 없습니다.' : '기록이 없습니다.'}
                </p>
              ) : (
                filteredAdminSubmissions.slice((adminPage - 1) * 5, adminPage * 5).map((sub) => (
                  <div key={sub.id} className="p-4 flex flex-row gap-3 sm:gap-4 items-center hover:bg-gray-50">
                    {editingId === sub.id ? (
                      <div className="w-full bg-blue-50/50 flex flex-col gap-3 p-3 rounded-xl border border-blue-100">
                        <div className="flex flex-col sm:flex-row gap-4">
                          {/* 사진 수정 영역 */}
                          <div 
                            onClick={triggerAdminFileInput}
                            className="w-full sm:w-28 h-28 shrink-0 rounded-lg border-2 border-dashed border-blue-300 flex flex-col items-center justify-center overflow-hidden bg-white relative cursor-pointer hover:bg-blue-50 transition-colors"
                          >
                            {editFormData.photoPreview ? (
                              <>
                                <img src={editFormData.photoPreview} alt="Preview" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                  <Camera className="w-6 h-6 text-white mb-1" />
                                  <span className="text-white text-[10px] font-bold">사진 변경</span>
                                </div>
                              </>
                            ) : (
                              <div className="flex flex-col items-center text-blue-400 p-2">
                                <ImageIcon className="w-6 h-6 mb-1" />
                                <span className="text-[10px] font-bold text-center">사진 재등록</span>
                              </div>
                            )}
                          </div>
                          
                          {/* 텍스트 정보 수정 영역 */}
                          <div className="flex-1 flex flex-col gap-2">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <input type="text" name="cellName" value={editFormData.cellName} onChange={handleEditChange} placeholder="셀 이름" className="p-2 text-sm border rounded focus:ring-1 focus:ring-blue-500 outline-none bg-white" />
                              <input type="text" name="name" value={editFormData.name} onChange={handleEditChange} placeholder="이름" className="p-2 text-sm border rounded focus:ring-1 focus:ring-blue-500 outline-none bg-white" />
                              <select name="position" value={editFormData.position} onChange={handleEditChange} className="p-2 text-sm border rounded focus:ring-1 focus:ring-blue-500 outline-none bg-white">
                                <option value="성도">성도</option>
                                <option value="집사">집사</option>
                                <option value="권사">권사</option>
                                <option value="장로">장로</option>
                              </select>
                              <input type="date" name="date" value={editFormData.date} onChange={handleEditChange} className="p-2 text-sm border rounded focus:ring-1 focus:ring-blue-500 outline-none bg-white" />
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex justify-end gap-2 mt-1">
                          <button onClick={cancelEditing} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-300 transition-colors">취소</button>
                          <button onClick={saveEdit} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors">저장</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {sub.photoPreview && (
                          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden shrink-0 border border-gray-200">
                            <img src={sub.photoPreview} alt="인증" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-gray-900 text-sm sm:text-base truncate">{sub.name} <span className="text-[10px] sm:text-xs text-gray-500 font-normal">{sub.position}</span></span>
                            <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md whitespace-nowrap">{sub.cellName}셀</span>
                          </div>
                          <div className="text-xs sm:text-sm text-gray-500">인증일: {sub.date}</div>
                        </div>
                        <div className="flex gap-1 sm:gap-2 shrink-0">
                          <button 
                            onClick={() => startEditing(sub)}
                            className="p-1.5 sm:p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="기록 수정"
                          >
                            <Edit2 className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>
                          <button 
                            onClick={() => handleDeleteClick(sub.id)}
                            className="p-1.5 sm:p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="기록 삭제"
                          >
                            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
            
            {/* 전체 인증 기록 페이지네이션 (5개씩) */}
            {filteredAdminSubmissions.length > 5 && (
              <div className="pb-5 pt-1 border-t border-gray-100">
                {renderPagination(adminPage, filteredAdminSubmissions.length, 5, setAdminPage)}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center font-sans">
      <div className="w-full max-w-md bg-white min-h-screen shadow-2xl relative">
        {AlertModal()}
        {ConfirmModal()}
        {ImageModal()}
        {isLoading && LoadingOverlay()}
        
        {currentView === 'form' && FormView()}
        {currentView === 'success' && SuccessView()}
        {currentView === 'results' && ResultsView()}
        {currentView === 'admin' && AdminView()}
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        
        /* 스크롤바 생성/소멸로 인한 화면 가로 흔들림 방지 */
        html { overflow-y: scroll; }
      `}} />
    </div>
  );
}
