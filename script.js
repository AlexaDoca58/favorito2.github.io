// Hacemos las funciones globales para que el HTML pueda llamarlas
let playNextTrack;
let playPrevTrack;
let togglePlayPause; 

document.addEventListener('DOMContentLoaded', () => {
    // 1. OBTENER ELEMENTOS DEL DOM
    const playPauseBtn = document.getElementById('play-pause-btn');
    const trackTitle = document.getElementById('track-title');
    const trackArtistInfo = document.getElementById('track-artist-info'); 
    const visualizerCanvas = document.getElementById('frequency-visualizer');
    const visualizerPlaceholder = document.querySelector('.visualizer-placeholder');
    const canvasCtx = visualizerCanvas.getContext('2d');
    
    // NUEVOS ELEMENTOS
    const progressBar = document.getElementById('progress-bar');
    const tracklistCardsContainer = document.getElementById('tracklist-cards'); // Contenedor de las CARDS
    const primaryActionButton = document.querySelector('.player-actions .primary'); // Botón "Reproducir" de arriba

    // Elemento de mensaje de error/info
    const errorMessage = document.getElementById('error-message');

    // 2. LISTA DE CANCIONES (¡SOLO 6!)
    const tracks = [
        { id: 1, title: 'Once Upon a Time', src: './Audio/01. Once Upon A Time.mp3', duration: '1:03' },
        { id: 2, title: 'Fallen Down', src: './Audio/02. Fallen Down.mp3', duration: '0:58' },
        { id: 3, title: 'Your Best Friend', src: './Audio/03. Your Best Friend.mp3', duration: '0:20' },
        { id: 4, title: 'Ruins', src: './Audio/04. Ruins.mp3', duration: '1:30' },
        { id: 5, title: 'Heartache', src: './Audio/05. Heartache.mp3', duration: '1:34' },
        { id: 6, title: 'Snowdin Town', src: './Audio/06. Snowdin Town.mp3', duration: '1:17' }
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

    // Función de Utilidad
    const formatTime = (seconds) => {
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min}:${sec.toString().padStart(2, '0')}`;
    };

    const showError = (message) => {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
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
                showError('Error al inicializar el audio. Asegúrate de que el navegador lo soporte.');
                return false;
            }
        }
        return true;
    };

    const drawVisualizer = () => {
        if (!analyser || audio.paused) {
            stopVisualizer();
            return;
        }
        
        animationId = requestAnimationFrame(drawVisualizer);
        
        analyser.getByteFrequencyData(dataArray);

        visualizerCanvas.width = visualizerCanvas.clientWidth;
        visualizerCanvas.height = visualizerCanvas.clientHeight;
        
        canvasCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);

        const barWidth = (visualizerCanvas.width / dataArray.length) * 2.5;
        let x = 0;

        for (let i = 0; i < dataArray.length; i++) {
            const barHeight = (dataArray[i] / 255) * visualizerCanvas.height;
            
            // Colores Rojos/Amarillos para el visualizador (según tu paleta)
            const gradient = canvasCtx.createLinearGradient(0, visualizerCanvas.height - barHeight, 0, visualizerCanvas.height);
            gradient.addColorStop(0, '#ffd700'); 
            gradient.addColorStop(1, '#ff0000'); 
            
            canvasCtx.fillStyle = gradient;
            canvasCtx.fillRect(x, visualizerCanvas.height - barHeight, barWidth, barHeight);
            x += barWidth + 2;
        }
        visualizerPlaceholder.style.display = 'none';
    };

    const stopVisualizer = () => {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        if (canvasCtx) {
            visualizerCanvas.width = visualizerCanvas.clientWidth;
            visualizerCanvas.height = visualizerCanvas.clientHeight;
            canvasCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
        }
        visualizerPlaceholder.style.display = 'flex';
    };
    
    // 4. LÓGICA DEL REPRODUCTOR
    
    const updateTrackInfo = () => {
        const track = tracks[currentTrackIndex];
        trackTitle.textContent = track.title;
        trackArtistInfo.textContent = `Toby Fox · ${track.duration || '--:--'}`; 

        // Actualizar el estado 'active' de las tarjetas
        document.querySelectorAll('.track-card').forEach((card, i) => {
            card.classList.toggle('active', i === currentTrackIndex);
        });
    };

    const loadTrack = (index) => {
        stopVisualizer();
        
        currentTrackIndex = index;
        audio.src = tracks[currentTrackIndex].src;
        updateTrackInfo();
        
        audio.load();
        progressBar.value = 0;
        
        if (!audio.paused) {
            playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
            primaryActionButton.innerHTML = '<i class="fa-solid fa-play"></i> Reproducir';
        }
    };
    
    // Hacemos togglePlayPause global para los botones Play/Pause
    togglePlayPause = (forcePlay = false) => {
        if (!audio.src) {
            loadTrack(0);
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
                primaryActionButton.innerHTML = '<i class="fa-solid fa-pause"></i> Pausar';
                drawVisualizer();
            }).catch(error => {
                showError("Error al reproducir. Revisa la ruta de tus archivos de audio en ./Audio/");
                playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
                primaryActionButton.innerHTML = '<i class="fa-solid fa-play"></i> Reproducir';
            });
        } else {
            audio.pause();
            playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
            primaryActionButton.innerHTML = '<i class="fa-solid fa-play"></i> Reproducir';
            stopVisualizer();
        }
    };

    playNextTrack = () => {
        let nextIndex = (currentTrackIndex + 1) % tracks.length;
        // La lógica de Shuffle (Mezcla) puede implementarse aquí si añades el botón 'mix-btn'
        
        loadTrack(nextIndex);
        if (!audio.paused || isUserInteraction) {
            setTimeout(() => togglePlayPause(true), 100); 
        }
    };

    playPrevTrack = () => {
        // Si han pasado más de 3 segundos, reinicia la canción
        if (audio.currentTime > 3) {
            audio.currentTime = 0;
            return;
        }
        
        const prevIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
        loadTrack(prevIndex);
        if (!audio.paused || isUserInteraction) {
            setTimeout(() => togglePlayPause(true), 100); 
        }
    };

    // 5. RENDERIZACIÓN DE LA LISTA (COMO CARDS)
    const renderTracklist = () => {
        tracklistCardsContainer.innerHTML = '';
        tracks.forEach((track, index) => {
            const card = document.createElement('div');
            card.classList.add('track-card');
            card.dataset.index = index;
            card.innerHTML = `
                <span class="track-id">${track.id.toString().padStart(2, '0')}</span>
                <span class="track-title">${track.title}</span>
                <span class="track-duration">${track.duration}</span>
            `;
            card.addEventListener('click', () => {
                loadTrack(index);
                setTimeout(() => togglePlayPause(true), 100); 
            });
            tracklistCardsContainer.appendChild(card);
        });
    };
    
    // 6. LÓGICA DE LA BARRA DE PROGRESO
    audio.addEventListener('timeupdate', () => {
        const currentTime = audio.currentTime;
        const duration = audio.duration;
        
        if (!isNaN(duration)) {
            const progressPercent = (currentTime / duration) * 100;
            progressBar.value = progressPercent;
        }
    });

    audio.addEventListener('loadedmetadata', () => {
        if (!isNaN(audio.duration)) {
            // Actualizar la duración en la cabecera cuando el archivo está listo
            const durationText = formatTime(audio.duration);
            trackArtistInfo.textContent = `Toby Fox · ${durationText}`;
        }
    });

    progressBar.addEventListener('input', () => {
        const duration = audio.duration;
        if (!isNaN(duration)) {
            const newTime = (progressBar.value * duration) / 100;
            audio.currentTime = newTime;
        }
    });

    // 7. ASIGNACIÓN DE EVENT LISTENERS Y SETUP
    
    playPauseBtn.addEventListener('click', () => togglePlayPause());
    
    // Navegación (Música/Arte)
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
    
    // Funcionalidad para botones dummy (ej. Quitar, Listas, Volumen)
    document.querySelectorAll('.dummy-action').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            let text = e.currentTarget.textContent.trim().replace(/[\u{1F600}-\u{1F6FF}]/gu, '').trim(); 
            if (text === '') { // Para botones solo de iconos
                text = e.currentTarget.querySelector('i').className.split('-').pop();
            }
            showError(`La función "${text}" es sólo visual/dúmmy.`);
        });
    });


    audio.addEventListener('ended', playNextTrack);
    audio.addEventListener('error', (e) => {
        showError('Error al cargar el audio. Archivos no encontrados en la carpeta Audio/.');
    });

    // Inicialización
    renderTracklist();
    loadTrack(0); // Carga la primera canción al iniciar
    
    // Ajuste de Canvas
    const resizeCanvas = () => {
        visualizerCanvas.width = visualizerCanvas.clientWidth;
        visualizerCanvas.height = visualizerCanvas.clientHeight;
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
});
