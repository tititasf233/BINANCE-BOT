# Use uma imagem base oficial do Python
FROM python:3.9-slim

# Define o diretório de trabalho
WORKDIR /app

# Copia o arquivo de dependências
COPY requirements.txt .

# Instala as dependências
RUN pip install --no-cache-dir -r requirements.txt

# Copia o código da aplicação
COPY app.py .

# Expõe a porta 5000
EXPOSE 5000

# Define variáveis de ambiente
ENV FLASK_APP=app.py
ENV FLASK_ENV=production

# Comando para iniciar a aplicação
CMD ["python", "app.py"]