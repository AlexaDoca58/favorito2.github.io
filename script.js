// Hacemos las funciones globales para que el HTML pueda llamarlas
let playNextTrack;
let playPrevTrack;
let togglePlayPause; // Hacemos esta global para el botón "Reproducir" de arriba

document.addEventListener('DOMContentLoaded', () => {
    // 1. OBTENER ELEMENTOS DEL DOM
    const playPauseBtn = document.getElementById('play-pause-btn');
    const trackTitle = document.getElementById('track-title');
    const trackArtistInfo = document.getElementById('track-artist-info'); 
    const visualizerCanvas = document.getElementById('frequency-visualizer');
    const canvasCtx = visualizerCanvas.getContext('2d');
    
    // NUEVOS ELEMENTOS
    const progressBar = document.getElementById('progress-bar');
    const mixBtn = document.querySelector('.mix-btn');
    const playAllBtn = document.querySelector('.play-all-btn');
    const tracklistCardsContainer = document.getElementById('tracklist-cards');

    // Elemento de mensaje de error/info
    const errorMessage = document.getElementById('error-message');


    // 2. LISTA DE CANCIONES (¡CON DURACIÓN Y NOMBRES CORREGIDOS!)
    // NOTA: Asegúrate de que los archivos .mp3 existan en la ruta './Audio/'
    const tracks = [
        { title: 'Once Upon a Time', src: './Audio/01. Once Upon A Time.mp3', duration: '1:03' },
        { title: 'Fallen Down', src: './Audio/04. Fallen Down.mp3', duration: '1:48' },
        { title: 'Your Best Friend', src: './Audio/03. Your Best Friend.mp3', duration: '0:30' },
        { title: 'Ruins', src: './Audio/05. Ruins.mp3', duration: '1:33' },
        { title: 'Heartache', src: './Audio/14. Heartache.mp3', duration: '1:49' },
        { title: 'Snowdin Town', src: './Audio/22. Snowdin Town.mp3', duration: '1:16' }
    ];

    const audio = new Audio();
    let currentTrackIndex = 0;
    let audioContext;
    let analyser;
    let sourceNode = null;
    let dataArray;
    let animationId;
    let isUserInteraction = false;
    let isShuffling = false; 

    // Función auxiliar para formatear el tiempo
    const formatTime = (seconds) => {
        if (isNaN(seconds) || seconds < 0) return '--:--';
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min}:${sec < 10 ? '0' : ''}${sec}`;
    };

    const showError = (message) => {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        errorMessage.style.backgroundColor = message.includes('Error') ? '#ff4444' : '#ffd700';
        errorMessage.style.color = message.includes('Error') ? 'white' : 'black';
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    };

    // 3. FUNCIONES DE AUDIO CONTEXT Y VISUALIZADOR
    const initAudioContext = () => {
        if (!audioContext) {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;
                const bufferLength = analyser.frequencyBinCount;
                dataArray = new Uint8Array(bufferLength);
                
                if (!sourceNode) {
                    sourceNode = audioContext.createMediaElementSource(audio);
                    sourceNode.connect(analyser);
                    analyser.connect(audioContext.destination);
                }
            } catch (error) {
                showError('Error al inicializar el audio. El navegador lo bloqueó.');
                return false;
            }
        }
        return true;
    };

    const drawVisualizer = () => {
        if (!analyser) return;
        
        animationId = requestAnimationFrame(drawVisualizer);
        
        visualizerCanvas.width = visualizerCanvas.clientWidth;
        visualizerCanvas.height = visualizerCanvas.clientHeight;
        
        analyser.getByteFrequencyData(dataArray);
        canvasCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);

        const barWidth = (visualizerCanvas.width / dataArray.length) * 2.5;
        let x = 0;

        for (let i = 0; i < dataArray.length; i++) {
            const barHeight = Math.min((dataArray[i] / 255) * visualizerCanvas.height, visualizerCanvas.height); 
            
            // Colores Rojos/Rosados para el visualizador
            const gradient = canvasCtx.createLinearGradient(0, visualizerCanvas.height - barHeight, 0, visualizerCanvas.height);
            gradient.addColorStop(0, '#ff0000'); // Rojo fuerte
            gradient.addColorStop(1, '#ff6666'); // Rojo claro
            
            canvasCtx.fillStyle = gradient;
            canvasCtx.fillRect(x, visualizerCanvas.height - barHeight, barWidth, barHeight);
            x += barWidth + 2; 
        }
    };

    const stopVisualizer = () => {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        // Dejar el canvas con el placeholder
    };
    
    // 4. LÓGICA DEL REPRODUCTOR
    
    const loadTrack = (index, autoPlay = false) => {
        stopVisualizer();
        const wasPlaying = !audio.paused;

        currentTrackIndex = index;
        const currentTrack = tracks[currentTrackIndex];
        audio.src = currentTrack.src;
        
        trackTitle.textContent = currentTrack.title;
        trackArtistInfo.textContent = `Toby Fox · ${currentTrack.duration}`; 
        
        audio.load();
        progressBar.value = 0;

        // Actualizar el estado 'playing' de las cards
        document.querySelectorAll('.marked-card').forEach((card, i) => {
             card.classList.toggle('playing', i === index);
        });
        
        if (wasPlaying || autoPlay) {
            setTimeout(() => togglePlayPause(true), 100);
        } else {
             playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        }
    };

    togglePlayPause = (forcePlay = false) => {
        if (!audio.src) {
            loadTrack(currentTrackIndex, true);
            return;
        }
        
        if (audio.paused || forcePlay) {
            if (!isUserInteraction) {
                if (!initAudioContext()) return;
                isUserInteraction = true;
            }
            
            if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume().catch(() => {
                    showError('Error al reanudar el audio. Haz clic nuevamente.');
                    return;
                });
            }
            
            audio.play().then(() => {
                playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
                drawVisualizer(); 
            }).catch(error => {
                showError("Error de reproducción. Verifica que el archivo de audio exista.");
                playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
            });
        } else {
            audio.pause();
            playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
            stopVisualizer();
        }
    };

    playNextTrack = () => {
        let nextIndex;
        if (isShuffling) {
            let randomIndex;
            do {
                randomIndex = Math.floor(Math.random() * tracks.length);
            } while (randomIndex === currentTrackIndex);
            nextIndex = randomIndex;
        } else {
            nextIndex = (currentTrackIndex + 1) % tracks.length;
        }
        
        loadTrack(nextIndex, true);
    };

    playPrevTrack = () => {
        const prevIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
        loadTrack(prevIndex, true);
    };

    const handleMixToggle = () => {
        isShuffling = !isShuffling;
        mixBtn.classList.toggle('active', isShuffling);
        mixBtn.innerHTML = isShuffling 
            ? '<i class="fa-solid fa-shuffle"></i> Mezcla ACTIVA'
            : '<i class="fa-solid fa-shuffle"></i> Mezclar favoritos';
        
        showError(isShuffling ? 'Mezcla (Shuffle) activada.' : 'Mezcla (Shuffle) desactivada.');
    };

    const handlePlayAll = () => {
        loadTrack(0, true);
        if (isShuffling) {
            isShuffling = false; 
            mixBtn.classList.remove('active');
            mixBtn.innerHTML = '<i class="fa-solid fa-shuffle"></i> Mezclar favoritos';
        }
        showError('Reproducción en orden iniciada.');
    };

    // FUNCIÓN PARA CREAR LAS CARDS EN LA LISTA MARCADA
    const renderTracklist = () => {
        tracklistCardsContainer.innerHTML = ''; // Limpiar
        
        tracks.forEach((track, index) => {
            const card = document.createElement('div');
            card.className = 'marked-card';
            card.dataset.index = index; 
            
            card.innerHTML = `
                <p>${track.title}</p>
                <small>${track.duration}</small>
            `;
            
            card.addEventListener('click', () => {
                loadTrack(index, true);
            });
            
            tracklistCardsContainer.appendChild(card);
        });
    };
    
    // 5. LÓGICA DE LA BARRA DE PROGRESO
    audio.addEventListener('timeupdate', () => {
        const currentTime = audio.currentTime;
        const duration = audio.duration;
        
        if (!isNaN(duration) && isFinite(duration)) {
            const progressPercent = (currentTime / duration) * 100;
            progressBar.value = progressPercent;
        }
    });
    
    // Lógica para actualizar la barra al arrastrarla
    progressBar.addEventListener('input', () => {
        const duration = audio.duration;
        
        if (!isNaN(duration) && isFinite(duration)) {
            const newTime = (progressBar.value * duration) / 100;
            audio.currentTime = newTime;
        }
    });

    // 6. ASIGNACIÓN DE EVENT LISTENERS Y SETUP
    playPauseBtn.addEventListener('click', () => togglePlayPause(false));
    mixBtn.addEventListener('click', handleMixToggle);
    playAllBtn.addEventListener('click', handlePlayAll);

    // Navegación y botones DUMMY
    document.querySelectorAll('.dummy-action').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const text = e.currentTarget.textContent.trim();
            showError(`La función "${text}" es sólo visual/dúmmy.`);
        });
    });

    document.querySelectorAll('.nav-top-btn').forEach(item => {
        item.addEventListener('click', (event) => {
            document.querySelectorAll('.nav-top-btn').forEach(i => i.classList.remove('active'));
            event.currentTarget.classList.add('active');
            
            const sectionId = event.currentTarget.dataset.section;
            document.querySelectorAll('.content-section').forEach(section => {
                section.classList.toggle('active', section.id === `${sectionId}-section`);
            });
        });
    });

    audio.addEventListener('ended', playNextTrack);
    audio.addEventListener('error', (e) => {
        showError('Error al cargar el audio. Archivos no encontrados en la carpeta Audio/.');
    });

    // Inicialización
    renderTracklist();
    loadTrack(currentTrackIndex); 
});
