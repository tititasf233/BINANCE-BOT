from flask import Flask, jsonify, request
import docker
import json
from datetime import datetime

app = Flask(__name__)

# Inicializa o cliente Docker
def get_docker_client():
    try:
        return docker.from_env()
    except Exception as e:
        print(f"Erro ao conectar com Docker: {e}")
        return None

client = get_docker_client()

@app.route('/health', methods=['GET'])
def health_check():
    """Endpoint de health check"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'docker_connected': client is not None
    })

@app.route('/containers', methods=['GET'])
def list_running_containers():
    """Lista todos os containers em execução"""
    if client is None:
        return jsonify({'error': 'Docker client não conectado'}), 503
    try:
        containers = client.containers.list()
        result = []
        for container in containers:
            result.append({
                'id': container.id[:12],
                'name': container.name,
                'status': container.status,
                'image': container.image.tags[0] if container.image.tags else 'unknown'
            })
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/containers/all', methods=['GET'])
def list_all_containers():
    """Lista todos os containers (incluindo parados)"""
    if client is None:
        return jsonify({'error': 'Docker client não conectado'}), 503
    try:
        containers = client.containers.list(all=True)
        result = []
        for container in containers:
            result.append({
                'id': container.id[:12],
                'name': container.name,
                'status': container.status,
                'image': container.image.tags[0] if container.image.tags else 'unknown'
            })
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/containers/<container_id>/start', methods=['POST'])
def start_container(container_id):
    """Inicia um container específico"""
    if client is None:
        return jsonify({'error': 'Docker client não conectado'}), 503
    try:
        container = client.containers.get(container_id)
        container.start()
        return jsonify({
            'message': f'Container {container_id} iniciado com sucesso',
            'status': 'started'
        })
    except docker.errors.NotFound:
        return jsonify({'error': 'Container não encontrado'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/containers/<container_id>/stop', methods=['POST'])
def stop_container(container_id):
    """Para um container específico"""
    if client is None:
        return jsonify({'error': 'Docker client não conectado'}), 503
    try:
        container = client.containers.get(container_id)
        container.stop()
        return jsonify({
            'message': f'Container {container_id} parado com sucesso',
            'status': 'stopped'
        })
    except docker.errors.NotFound:
        return jsonify({'error': 'Container não encontrado'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/containers/<container_id>/logs', methods=['GET'])
def get_container_logs(container_id):
    """Obtém os últimos logs de um container"""
    if client is None:
        return jsonify({'error': 'Docker client não conectado'}), 503
    try:
        container = client.containers.get(container_id)
        logs = container.logs(tail=100, timestamps=True).decode('utf-8')
        return jsonify({
            'container_id': container_id,
            'logs': logs
        })
    except docker.errors.NotFound:
        return jsonify({'error': 'Container não encontrado'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/containers/<container_id>/remove', methods=['DELETE'])
def remove_container(container_id):
    """Remove um container"""
    if client is None:
        return jsonify({'error': 'Docker client não conectado'}), 503
    try:
        force = request.args.get('force', 'false').lower() == 'true'
        container = client.containers.get(container_id)
        container.remove(force=force)
        return jsonify({
            'message': f'Container {container_id} removido com sucesso',
            'status': 'removed'
        })
    except docker.errors.NotFound:
        return jsonify({'error': 'Container não encontrado'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/containers/<container_id>/exec', methods=['POST'])
def exec_command(container_id):
    """Executa um comando dentro de um container"""
    if client is None:
        return jsonify({'error': 'Docker client não conectado'}), 503
    try:
        data = request.get_json()
        if not data or 'command' not in data:
            return jsonify({'error': 'Campo "command" é obrigatório'}), 400
        
        container = client.containers.get(container_id)
        result = container.exec_run(data['command'])
        
        return jsonify({
            'container_id': container_id,
            'command': data['command'],
            'exit_code': result.exit_code,
            'output': result.output.decode('utf-8')
        })
    except docker.errors.NotFound:
        return jsonify({'error': 'Container não encontrado'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)