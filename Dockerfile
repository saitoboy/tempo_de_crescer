FROM python:3.11-slim

WORKDIR /app

# Copiar arquivos
COPY requirements.txt .
COPY dashboard_streamlit.py .
COPY output ./output

# Instalar dependências
RUN pip install --no-cache-dir -r requirements.txt

# Expor porta
EXPOSE 8501

# Configurar Streamlit
RUN mkdir -p ~/.streamlit
RUN echo "[server]" > ~/.streamlit/config.toml && \
    echo "headless = true" >> ~/.streamlit/config.toml && \
    echo "port = 8501" >> ~/.streamlit/config.toml && \
    echo "enableCORS = false" >> ~/.streamlit/config.toml && \
    echo "address = \"0.0.0.0\"" >> ~/.streamlit/config.toml

# Comando para iniciar
CMD ["streamlit", "run", "dashboard_streamlit.py", "--server.port=8501", "--server.address=0.0.0.0"]
