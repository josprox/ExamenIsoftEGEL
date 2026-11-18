package models

import (
	"time"
)

type Opcion struct {
	Texto       string `json:"texto"`
	Explicacion string `json:"explicacion"`
}

type Fuente struct {
	Recurso string `json:"recurso"`
	Detalle string `json:"detalle,omitempty"`
}

type User struct {
	ID        uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	Name      string    `gorm:"size:255;not null" json:"name"`
	Email     string    `gorm:"size:255;uniqueIndex;not null" json:"email"`
	Password  string    `gorm:"size:255;not null" json:"-"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (User) TableName() string { return "users" }

type UserToken struct {
	ID        uint64     `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    uint64     `gorm:"not null;index" json:"user_id"`
	Token     string     `gorm:"size:64;uniqueIndex;not null" json:"-"`
	ExpiresAt *time.Time `json:"expires_at"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
	User      User       `gorm:"foreignKey:UserID" json:"-"`
}

func (UserToken) TableName() string { return "user_tokens" }

type Pregunta struct {
	ID         string    `gorm:"primaryKey;size:40" json:"id"`
	Area       string    `gorm:"size:16;index;not null" json:"area"`
	Subarea    string    `gorm:"size:16;index;not null" json:"subarea"`
	Banco      string    `gorm:"size:32;index;not null" json:"banco"`
	Formato    string    `gorm:"size:40;not null" json:"formato"`
	Nivel      *string   `gorm:"size:24" json:"nivel"`
	Estimulo   *string   `gorm:"type:longtext" json:"estimulo"`
	Base       *string   `gorm:"type:longtext" json:"base"`
	Lista      []string  `gorm:"serializer:json;type:json" json:"lista"`
	Codigo     *string   `gorm:"type:longtext" json:"codigo"`
	Pregunta   string    `gorm:"type:text;not null" json:"pregunta"`
	Opciones   []Opcion  `gorm:"serializer:json;type:json;not null" json:"opciones"`
	Correcta   int       `gorm:"not null" json:"correcta"`
	Estrategia *string   `gorm:"type:text" json:"estrategia"`
	Trampa     *string   `gorm:"type:text" json:"trampa"`
	Conceptos  []string  `gorm:"serializer:json;type:json" json:"conceptos"`
	Fuentes    []Fuente  `gorm:"serializer:json;type:json" json:"fuentes"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

func (Pregunta) TableName() string { return "preguntas" }

// PreguntaSinRespuesta oculta los campos de solución durante el modo Examen Real.
type PreguntaSinRespuesta struct {
	ID        string   `json:"id"`
	Area      string   `json:"area"`
	Subarea   string   `json:"subarea"`
	Banco     string   `json:"banco"`
	Formato   string   `json:"formato"`
	Nivel     *string  `json:"nivel"`
	Estimulo  *string  `json:"estimulo"`
	Base      *string  `json:"base"`
	Lista     []string `json:"lista"`
	Codigo    *string  `json:"codigo"`
	Pregunta  string   `json:"pregunta"`
	Opciones  []Opcion `json:"opciones"`
	Conceptos []string `json:"conceptos"`
	Fuentes   []Fuente `json:"fuentes"`
}

func (p Pregunta) OcultarRespuestas() PreguntaSinRespuesta {
	ops := make([]Opcion, len(p.Opciones))
	for i, o := range p.Opciones {
		ops[i] = Opcion{Texto: o.Texto, Explicacion: ""}
	}
	return PreguntaSinRespuesta{
		ID:        p.ID,
		Area:      p.Area,
		Subarea:   p.Subarea,
		Banco:     p.Banco,
		Formato:   p.Formato,
		Nivel:     p.Nivel,
		Estimulo:  p.Estimulo,
		Base:      p.Base,
		Lista:     p.Lista,
		Codigo:    p.Codigo,
		Pregunta:  p.Pregunta,
		Opciones:  ops,
		Conceptos: p.Conceptos,
		Fuentes:   p.Fuentes,
	}
}

type Recurso struct {
	ID        string    `gorm:"primaryKey;size:80" json:"id"`
	Titulo    string    `gorm:"size:255;not null" json:"titulo"`
	Autores   *string   `gorm:"size:255" json:"autores"`
	Anio      *int      `json:"anio"`
	Tipo      string    `gorm:"size:32;index;not null" json:"tipo"`
	Areas     []string  `gorm:"serializer:json;type:json;not null" json:"areas"`
	Subareas  []string  `gorm:"serializer:json;type:json" json:"subareas"`
	Oficial   bool      `gorm:"not null;default:false" json:"oficial"`
	Archivo   *string   `gorm:"size:500" json:"archivo"`
	URL       *string   `gorm:"size:500" json:"url"`
	Prioridad *int      `json:"prioridad"`
	Nota      *string   `gorm:"type:text" json:"nota"`
	Gratuito  bool      `gorm:"not null;default:false" json:"gratuito"`
	Idioma    *string   `gorm:"size:16" json:"idioma"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (Recurso) TableName() string { return "recursos" }

type Intento struct {
	ID               uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID           uint64    `gorm:"not null;index" json:"user_id"`
	Modo             string    `gorm:"size:20;not null;default:inmediato" json:"modo"`
	AreaFiltro       *string   `gorm:"size:32" json:"area_filtro"`
	BancoFiltro      *string   `gorm:"size:32" json:"banco_filtro"`
	PreguntaIDs      []string  `gorm:"column:pregunta_ids;serializer:json;type:json" json:"pregunta_ids"`
	TotalPreguntas   int       `gorm:"not null" json:"total_preguntas"`
	Aciertos         int       `gorm:"not null;default:0" json:"aciertos"`
	Errores          int       `gorm:"not null;default:0" json:"errores"`
	Porcentaje       int       `gorm:"not null;default:0" json:"porcentaje"`
	DuracionSegundos int       `gorm:"not null;default:0" json:"duracion_segundos"`
	Completado       bool      `gorm:"not null;default:false" json:"completado"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

func (Intento) TableName() string { return "intentos" }

type Respuesta struct {
	ID           uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	IntentoID    uint64    `gorm:"not null;uniqueIndex:idx_intento_pregunta" json:"intento_id"`
	UserID       uint64    `gorm:"not null;index" json:"user_id"`
	PreguntaID   string    `gorm:"size:40;not null;index;uniqueIndex:idx_intento_pregunta" json:"pregunta_id"`
	Area         string    `gorm:"size:16;not null" json:"area"`
	Subarea      string    `gorm:"size:16;not null" json:"subarea"`
	Seleccionada int       `gorm:"not null" json:"seleccionada"`
	Correcta     int       `gorm:"not null" json:"correcta"`
	EsCorrecta   bool      `gorm:"not null" json:"es_correcta"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func (Respuesta) TableName() string { return "respuestas" }
