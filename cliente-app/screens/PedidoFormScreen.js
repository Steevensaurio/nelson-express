import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TextInput } from 'react-native';
import { useState } from 'react';

const PedidoFormScreen = () => {

    const [descripcion, setDescripcion] = useState('');
    const [origen_direccion, setDireccionOrigen] = useState('');
    const [origen_lat, setLatitudOrigen] = useState('');
    const [origen_lng, setLongitudOrigen] = useState('');

    const [destino_direccion, setDireccionDestino] = useState('');
    const [destino_lat, setLatitudDestino] = useState('');
    const [destino_lng, setLongitudDestino] = useState('');

    return(
        <View style={styles.container}>
            <Text>Nelson Express App</Text>
            <StatusBar style="auto" />
            <TextInput
                value={descripcion}
                onChangeText={setDescripcion}
                placeholder="Descripción del Pedido"
            />
            <TextInput
                value={origen_direccion}
                onChangeText={setDireccionOrigen}
                placeholder="Dirección de origen del pedido"
            />
            <TextInput
                value={origen_lat}
                onChangeText={setLatitudOrigen}
                placeholder="Latitud de Origen"
            />
            <TextInput
                value={origen_lng}
                onChangeText={setLongitudOrigen}
                placeholder="Longitud de Origen"
            />
            <TextInput
                value={destino_direccion}
                onChangeText={setDireccionDestino}
                placeholder="Dirección de destino"
            />
            <TextInput
                value={destino_lat}
                onChangeText={setLatitudDestino}
                placeholder="Latitud de Destino"
            />
            <TextInput
                value={destino_lng}
                onChangeText={setLongitudDestino}
                placeholder="Longitud de Destino"
            />
        </View>
    )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default PedidoFormScreen;