-- Stored Procedure para agregar composición a un palet
CREATE PROCEDURE [dbo].[SP_Test_Palets_Composicion_Agregar]
    @PaletId INT,
    @ConsignatarioId INT,
    @DestinoId INT,
    @FormatoId INT,
    @TipoEmpaqueId INT,
    @CalibreId INT = NULL,
    @ClienteId INT = NULL,
    @CategoriaId INT = NULL,
    @TipoEmpaqueGuiaId INT = NULL,
    @TipoCajaId INT = NULL,
    @TipoClamshellId INT = NULL,
    @PresentacionId INT = NULL,
    @TipoProcesoEmpacadoId INT = NULL,
    @VariedadId INT,
    @VariedadGuiaId INT = NULL,
    @LugarProduccionId INT,
    @CodigoRanchoId INT,
    @TransporteId INT = NULL,
    @CantidadCajas INT,
    @PesoPorCaja DECIMAL(10,2),
    @PesoTotal DECIMAL(10,2),
    @EsReposicion BIT = 0,
    @EsEnsayo BIT = 0,
    @UsuarioId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @NuevaComposicionId INT;
    DECLARE @PesoCalculado DECIMAL(10,2);
    
    -- Calcular peso si no se proporciona
    IF @PesoPorCaja = 0 OR @PesoPorCaja IS NULL
    BEGIN
        SELECT @PesoPorCaja = ISNULL(f.PesoPorCaja, 0)
        FROM Formatos f
        WHERE f.Id = @FormatoId;
    END
    
    -- Calcular peso total
    SET @PesoTotal = @PesoPorCaja * @CantidadCajas;
    
    -- Insertar la composición
    INSERT INTO PaletComposicion (
        PaletId,
        ClienteId,
        ConsignatarioId,
        DestinoId,
        FormatoId,
        TipoEmpaqueId,
        CalibreId,
        VariedadId,
        LugarProduccionId,
        CodigoRanchoId,
        TransporteId,
        CantidadCajas,
        PesoPorCaja,
        PesoTotal,
        EsReposicion,
        EsEnsayo,
        FechaCreacion,
        UsuarioCreacionId,
        TipoEmpaqueGuiaId,
        TipoCajaId,
        TipoClamshellId,
        PresentacionId,
        TipoProcesoEmpacadoId,
        VariedadGuiaId,
        CategoriaId
    )
    VALUES (
        @PaletId,
        @ClienteId,
        @ConsignatarioId,
        @DestinoId,
        @FormatoId,
        @TipoEmpaqueId,
        @CalibreId,
        @VariedadId,
        @LugarProduccionId,
        @CodigoRanchoId,
        @TransporteId,
        @CantidadCajas,
        @PesoPorCaja,
        @PesoTotal,
        @EsReposicion,
        @EsEnsayo,
        GETDATE(),
        @UsuarioId,
        @TipoEmpaqueGuiaId,
        @TipoCajaId,
        @TipoClamshellId,
        @PresentacionId,
        @TipoProcesoEmpacadoId,
        @VariedadGuiaId,
        @CategoriaId
    );
    
    SET @NuevaComposicionId = SCOPE_IDENTITY();
    
    -- Actualizar el palet
    UPDATE Palets
    SET 
        CantidadCajas = (SELECT ISNULL(SUM(CantidadCajas), 0) FROM PaletComposicion WHERE PaletId = @PaletId),
        PesoTotal = (SELECT ISNULL(SUM(PesoTotal), 0) FROM PaletComposicion WHERE PaletId = @PaletId),
        PorcentajeAvance = CASE 
            WHEN f.LimiteCajasPorPalet IS NOT NULL AND f.LimiteCajasPorPalet > 0
            THEN CAST((SELECT ISNULL(SUM(CantidadCajas), 0) FROM PaletComposicion WHERE PaletId = @PaletId) * 100.0 / f.LimiteCajasPorPalet AS DECIMAL(5,2))
            ELSE 0
        END,
        PrimeraComposicionFecha = CASE 
            WHEN PrimeraComposicionFecha IS NULL 
            THEN (SELECT MIN(FechaCreacion) FROM PaletComposicion WHERE PaletId = @PaletId)
            ELSE PrimeraComposicionFecha
        END,
        FechaModificacion = GETDATE()
    FROM Palets p
    LEFT JOIN Formatos f ON p.FormatoId = f.Id
    WHERE p.Id = @PaletId;
    
    -- Devolver la composición creada
    SELECT 
        pc.Id,
        pc.PaletId,
        pc.ClienteId,
        pc.ConsignatarioId,
        pc.DestinoId,
        pc.FormatoId,
        pc.TipoEmpaqueId,
        pc.CalibreId,
        pc.VariedadId,
        pc.LugarProduccionId,
        pc.CodigoRanchoId,
        pc.TransporteId,
        pc.CantidadCajas,
        pc.PesoPorCaja,
        pc.PesoTotal,
        pc.EsReposicion,
        pc.EsEnsayo,
        pc.FechaCreacion,
        c.RazonSocial AS ClienteNombre,
        con.RazonSocial AS ConsignatarioNombre,
        d.Nombre AS DestinoNombre,
        f.Descripcion AS FormatoNombre,
        te.Descripcion AS TipoEmpaqueNombre,
        teg.Nombre AS TipoEmpaqueGuiaNombre,
        tpe.Codigo AS TipoProcesoEmpacadoCodigo,
        p.Nombre AS Presentacion,
        cal.Nombre AS CalibreNombre,
        v.Nombre AS VariedadNombre,
        lp.Codigo AS LugarProduccionCodigo,
        cr.Codigo AS CodigoRancho,
        t.Nombre AS TransporteNombre
    FROM 
        PaletComposicion pc
        LEFT JOIN Clientes c ON pc.ClienteId = c.Id
        LEFT JOIN Consignatarios con ON pc.ConsignatarioId = con.Id
        LEFT JOIN Destinos d ON pc.DestinoId = d.Id
        LEFT JOIN Formatos f ON pc.FormatoId = f.Id
        LEFT JOIN TiposEmpaque te ON pc.TipoEmpaqueId = te.Id
        LEFT JOIN TiposEmpaqueGuia teg ON pc.TipoEmpaqueGuiaId = teg.Id
        LEFT JOIN TiposProcesoEmpacado tpe ON pc.TipoProcesoEmpacadoId = tpe.Id
        LEFT JOIN Presentaciones p ON pc.PresentacionId = p.Id
        LEFT JOIN Calibres cal ON pc.CalibreId = cal.Id
        LEFT JOIN Variedades v ON pc.VariedadId = v.Id
        LEFT JOIN LugaresProduccion lp ON pc.LugarProduccionId = lp.Id
        LEFT JOIN CodigosRancho cr ON pc.CodigoRanchoId = cr.Id
        LEFT JOIN Transportes t ON pc.TransporteId = t.Id
    WHERE 
        pc.Id = @NuevaComposicionId;
END
