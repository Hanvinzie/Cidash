import { BadRequestException, Injectable } from '@nestjs/common';
import { ActivityType } from '@prisma/client';

export interface ValidationResult {
  isValid: boolean;
  calculatedDistanceMeters: number;
  averageSpeedMps: number;
}

@Injectable()
export class AntiCheatService {
  /**
   * Menghitung jarak spasial antara dua titik koordinat GPS menggunakan formula Haversine (dalam satuan meter).
   */
  calculateHaversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000; // Radius rata-rata bumi dalam meter
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Mengekstraksi array pasangan koordinat [longitude, latitude] dari berbagai struktur GeoJSON.
   */
  extractCoordinates(geoJson: any): [number, number][] {
    if (!geoJson) {
      return [];
    }

    if (Array.isArray(geoJson)) {
      if (
        geoJson.length > 0 &&
        Array.isArray(geoJson[0]) &&
        typeof geoJson[0][0] === 'number'
      ) {
        return geoJson as [number, number][];
      }
    }

    if (geoJson.type === 'FeatureCollection' && Array.isArray(geoJson.features)) {
      for (const feature of geoJson.features) {
        if (
          feature.geometry &&
          feature.geometry.type === 'LineString' &&
          Array.isArray(feature.geometry.coordinates)
        ) {
          return feature.geometry.coordinates;
        }
      }
    }

    if (
      geoJson.type === 'Feature' &&
      geoJson.geometry &&
      geoJson.geometry.type === 'LineString' &&
      Array.isArray(geoJson.geometry.coordinates)
    ) {
      return geoJson.geometry.coordinates;
    }

    if (geoJson.type === 'LineString' && Array.isArray(geoJson.coordinates)) {
      return geoJson.coordinates;
    }

    return [];
  }

  /**
   * Memvalidasi integritas data perekaman GPS:
   * 1. Pemeriksaan anomali kecepatan (indikasi berkendara sepeda motor/mobil).
   * 2. Pemeriksaan lonjakan koordinat / teleportasi spasial (indikasi fake GPS spoofing).
   * 3. Konsistensi jarak yang dilaporkan terhadap rute kalkulasi koordinat.
   */
  validateActivity(
    type: ActivityType,
    distanceMeters: number,
    durationSeconds: number,
    averagePace: number,
    routeGeoJson: any,
  ): ValidationResult {
    if (durationSeconds <= 0) {
      throw new BadRequestException('Durasi olahraga tidak valid');
    }

    if (distanceMeters <= 0) {
      throw new BadRequestException('Jarak tempuh olahraga tidak valid');
    }

    const speedMps = distanceMeters / durationSeconds; // meter per detik

    // 1. Verifikasi Batas Kecepatan Maksimum Berdasarkan Jenis Aktivitas
    if (type === ActivityType.RUNNING) {
      // Kecepatan lari maksimal wajar manusia: < 8.5 m/s (~30.6 km/h) atau pace < 1.95 min/km
      if (speedMps > 8.5 || averagePace < 1.95) {
        throw new BadRequestException(
          'Aktivitas ditolak: Kecepatan lari melebihi batas manusiawi normal (terdeteksi indikasi penggunaan kendaraan bermotor).',
        );
      }
    } else if (type === ActivityType.CYCLING) {
      // Kecepatan sepeda kasual maksimal wajar: < 18.0 m/s (~64.8 km/h) atau pace < 0.9 min/km
      if (speedMps > 18.0 || averagePace < 0.9) {
        throw new BadRequestException(
          'Aktivitas ditolak: Kecepatan bersepeda melampaui batas wajar (terdeteksi indikasi penggunaan kendaraan bermotor).',
        );
      }
    }

    // 2. Pemeriksaan Kontinuitas Titik Koordinat GPS
    const coordinates = this.extractCoordinates(routeGeoJson);
    let cumulativeDistance = 0;

    if (coordinates.length >= 2) {
      const maxAllowedPointJumpMeters = 800; // Lonjakan maksimal antar titik koordinat berturutan

      for (let i = 0; i < coordinates.length - 1; i++) {
        const [lon1, lat1] = coordinates[i];
        const [lon2, lat2] = coordinates[i + 1];

        const stepDistance = this.calculateHaversineDistance(
          lat1,
          lon1,
          lat2,
          lon2,
        );

        if (stepDistance > maxAllowedPointJumpMeters) {
          throw new BadRequestException(
            'Aktivitas ditolak: Terdeteksi anomali lonjakan jarak koordinat GPS (indikasi teleportasi / manipulasi fake GPS).',
          );
        }

        cumulativeDistance += stepDistance;
      }

      // 3. Verifikasi Konsistensi Jarak yang Dilaporkan dengan Jalur Koordinat
      // Mengizinkan toleransi margin deviasi wajar (faktor kelokan mikro GPS)
      if (cumulativeDistance > 50) {
        const ratio = distanceMeters / cumulativeDistance;
        if (ratio < 0.25 || ratio > 3.0) {
          throw new BadRequestException(
            'Aktivitas ditolak: Jarak yang dilaporkan tidak konsisten dengan panjang lintasan koordinat rute yang terekam.',
          );
        }
      }
    }

    return {
      isValid: true,
      calculatedDistanceMeters: Math.round(cumulativeDistance * 100) / 100,
      averageSpeedMps: Math.round(speedMps * 100) / 100,
    };
  }
}
