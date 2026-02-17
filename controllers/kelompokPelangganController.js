import KelompokPelanggan from "../models/KelompokPelanggan.js";

// Create Kelompok Pelanggan (Admin)
export const createKelompokPelanggan = async (req, res) => {
  try {
    const {
      namaKelompok,
      hargaDiBawah10mKubik,
      hargaDiAtas10mKubik,
      biayaBeban,
    } = req.body;

    const kelompokPelanggan = new KelompokPelanggan({
      namaKelompok,
      hargaDiBawah10mKubik,
      hargaDiAtas10mKubik,
      biayaBeban: biayaBeban || null,
    });

    await kelompokPelanggan.save();

    res.status(201).json({
      status: 201,
      pesan: "Kelompok pelanggan created successfully",
      data: kelompokPelanggan,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

// Get All Kelompok Pelanggan
export const getAllKelompokPelanggan = async (req, res) => {
  try {
    const kelompokPelanggan = await KelompokPelanggan.find();

    res.status(200).json({
      status: 200,
      data: kelompokPelanggan,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

// Get Kelompok Pelanggan by ID
export const getKelompokPelangganById = async (req, res) => {
  try {
    const { id } = req.params;

    const kelompokPelanggan = await KelompokPelanggan.findById(id);

    if (!kelompokPelanggan) {
      return res.status(404).json({
        status: 404,
        pesan: "Kelompok pelanggan not found",
      });
    }

    res.status(200).json({
      status: 200,
      data: kelompokPelanggan,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

// Update Kelompok Pelanggan (Admin)
export const updateKelompokPelanggan = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const kelompokPelanggan = await KelompokPelanggan.findByIdAndUpdate(
      id,
      updates,
      { new: true }
    );

    if (!kelompokPelanggan) {
      return res.status(404).json({
        status: 404,
        pesan: "Kelompok pelanggan not found",
      });
    }

    res.status(200).json({
      status: 200,
      pesan: "Kelompok pelanggan updated successfully",
      data: kelompokPelanggan,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

// Delete Kelompok Pelanggan (Admin)
export const deleteKelompokPelanggan = async (req, res) => {
  try {
    const { id } = req.params;

    const kelompokPelanggan = await KelompokPelanggan.findByIdAndDelete(id);

    if (!kelompokPelanggan) {
      return res.status(404).json({
        status: 404,
        pesan: "Kelompok pelanggan not found",
      });
    }

    res.status(200).json({
      status: 200,
      pesan: "Kelompok pelanggan deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};
